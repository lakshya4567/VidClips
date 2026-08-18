/**
 * VidClips - EditorContext
 * Timeline-aware video editor state.
 *
 * Supports:
 * - Split clips
 * - Delete clips
 * - Timeline-aware playback
 * - Automatic skipping of deleted sections
 * - Timeline <-> source video time conversion
 * - Video thumbnails / preview
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  uploadVideo,
  getJob,
  checkHealth,
} from "../services/api";

const EditorContext = createContext(null);

const POLL_INTERVAL = 2000;

export function EditorProvider({ children }) {
  // =========================================================
  // VIDEO STATE
  // =========================================================

  const [videoFile, setVideoFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [videoName, setVideoName] = useState("");

  // =========================================================
  // PLAYBACK STATE
  //
  // currentTime = TIMELINE time
  // video.currentTime = SOURCE video time
  // =========================================================

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);

  const videoRef = useRef(null);

  // Prevent recursive seeking while changing clips.
  const isInternalSeekRef = useRef(false);

  // =========================================================
  // TIMELINE CLIPS
  // =========================================================

  const [clips, setClips] = useState([]);
  const [selectedClipId, setSelectedClipId] = useState(null);

  // =========================================================
  // AI JOB STATE
  // =========================================================

  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState("idle");
  const [jobProgress, setJobProgress] = useState(0);
  const [jobError, setJobError] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);

  // =========================================================
  // UI STATE
  // =========================================================

  const [backendOnline, setBackendOnline] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const [activeSidebarTab, setActiveSidebarTab] =
    useState("project");

  const [activeInspectorTab, setActiveInspectorTab] =
    useState("overview");

  const [selectedItem, setSelectedItem] = useState(null);

  const [zoom, setZoom] = useState(1);

  // =========================================================
  // SORT CLIPS
  // =========================================================

  const sortedClips = useCallback((clipList) => {
    return [...clipList].sort(
      (a, b) => Number(a.start || 0) - Number(b.start || 0)
    );
  }, []);

  // =========================================================
  // FIND CLIP AT TIMELINE TIME
  // =========================================================

  const getClipAtTimelineTime = useCallback(
    (time, clipList = clips) => {
      const sorted = sortedClips(clipList);

      return (
        sorted.find((clip) => {
          const start = Number(clip.start) || 0;
          const end = Number(clip.end) || 0;

          return time >= start && time < end;
        }) || null
      );
    },
    [clips, sortedClips]
  );

  // =========================================================
  // FIND NEXT CLIP
  // =========================================================

  const getNextClip = useCallback(
    (clip, clipList = clips) => {
      const sorted = sortedClips(clipList);

      if (!clip) return sorted[0] || null;

      const index = sorted.findIndex(
        (item) => item.id === clip.id
      );

      if (index === -1) return null;

      return sorted[index + 1] || null;
    },
    [clips, sortedClips]
  );

  // =========================================================
  // TIMELINE -> SOURCE VIDEO
  //
  // Example:
  //
  // Timeline clip:
  // start = 10
  // end = 20
  //
  // Source:
  // sourceStart = 30
  // sourceEnd = 40
  //
  // Timeline 15 -> Source 35
  // =========================================================

  const timelineToSourceTime = useCallback(
    (timelineTime, clipList = clips) => {
      const safeTime = Math.max(
        0,
        Number(timelineTime) || 0
      );

      const clip = getClipAtTimelineTime(
        safeTime,
        clipList
      );

      if (!clip) {
        return null;
      }

      const clipStart = Number(clip.start) || 0;

      const sourceStart =
        Number(clip.sourceStart) || 0;

      const offset =
        safeTime - clipStart;

      return sourceStart + offset;
    },
    [clips, getClipAtTimelineTime]
  );

  // =========================================================
  // SOURCE VIDEO -> TIMELINE
  // =========================================================

  const sourceToTimelineTime = useCallback(
    (sourceTime, clipList = clips) => {
      const safeSourceTime = Math.max(
        0,
        Number(sourceTime) || 0
      );

      const sorted = sortedClips(clipList);

      for (const clip of sorted) {
        const sourceStart =
          Number(clip.sourceStart) || 0;

        const sourceEnd =
          Number(clip.sourceEnd) || 0;

        if (
          safeSourceTime >= sourceStart &&
          safeSourceTime < sourceEnd
        ) {
          const timelineStart =
            Number(clip.start) || 0;

          return (
            timelineStart +
            (safeSourceTime - sourceStart)
          );
        }
      }

      return null;
    },
    [sortedClips]
  );

  // =========================================================
  // CALCULATE TIMELINE DURATION
  // =========================================================

  const getTimelineDuration = useCallback(
    (clipList = clips) => {
      if (!clipList.length) {
        return 0;
      }

      return Math.max(
        ...clipList.map(
          (clip) => Number(clip.end) || 0
        )
      );
    },
    [clips]
  );

  // =========================================================
  // BACKEND HEALTH
  // =========================================================

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        await checkHealth();

        if (mounted) {
          setBackendOnline(true);
        }
      } catch {
        if (mounted) {
          setBackendOnline(false);
        }
      }
    };

    check();

    const interval = setInterval(
      check,
      30000
    );

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // =========================================================
  // NOTIFICATIONS
  // =========================================================

  const addNotification = useCallback(
    (
      type,
      message,
      notificationDuration = 4000
    ) => {
      const id =
        Date.now() + Math.random();

      setNotifications((prev) => [
        ...prev,
        {
          id,
          type,
          message,
        },
      ]);

      if (notificationDuration > 0) {
        setTimeout(() => {
          setNotifications((prev) =>
            prev.filter(
              (notification) =>
                notification.id !== id
            )
          );
        }, notificationDuration);
      }

      return id;
    },
    []
  );

  const removeNotification = useCallback(
    (id) => {
      setNotifications((prev) =>
        prev.filter(
          (notification) =>
            notification.id !== id
        )
      );
    },
    []
  );

  // =========================================================
  // JOB POLLING
  // =========================================================

  useEffect(() => {
    if (
      !jobId ||
      jobStatus === "completed" ||
      jobStatus === "failed" ||
      jobStatus === "idle"
    ) {
      return;
    }

    let mounted = true;
    let timeoutId;

    const poll = async () => {
      try {
        const job = await getJob(jobId);

        if (!mounted) return;

        setJobStatus(job.status);

        if (job.status === "completed") {
          setJobError(null);

          addNotification(
            "success",
            "AI Analysis completed successfully!"
          );
        } else if (
          job.status === "failed"
        ) {
          setJobError(
            job.error || "Analysis failed"
          );

          addNotification(
            "error",
            `Analysis failed: ${
              job.error || "Unknown error"
            }`
          );
        } else {
          timeoutId = setTimeout(
            poll,
            POLL_INTERVAL
          );
        }
      } catch (err) {
        if (!mounted) return;

        setJobError(err.message);

        timeoutId = setTimeout(
          poll,
          POLL_INTERVAL * 2
        );
      }
    };

    poll();

    return () => {
      mounted = false;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    jobId,
    jobStatus,
    addNotification,
  ]);

  // =========================================================
  // VIDEO METADATA
  // =========================================================

  useEffect(() => {
    if (!videoURL) {
      setDuration(0);
      return;
    }

    let cancelled = false;

    const metadataVideo =
      document.createElement("video");

    metadataVideo.preload = "metadata";
    metadataVideo.muted = true;
    metadataVideo.playsInline = true;

    const handleMetadata = () => {
      if (cancelled) return;

      const videoDuration =
        Number(metadataVideo.duration);

      if (
        !Number.isFinite(videoDuration) ||
        videoDuration <= 0
      ) {
        return;
      }

      setDuration(videoDuration);

      setClips((prevClips) => {
        if (prevClips.length === 0) {
          return [
            {
              id: `clip-${Date.now()}`,
              start: 0,
              end: videoDuration,
              sourceStart: 0,
              sourceEnd: videoDuration,
              name: videoName,
            },
          ];
        }

        return prevClips.map(
          (clip, index) => {
            if (index !== 0) {
              return clip;
            }

            return {
              ...clip,
              start: 0,
              end: videoDuration,
              sourceStart: 0,
              sourceEnd: videoDuration,
            };
          }
        );
      });
    };

    const handleError = () => {
      if (cancelled) return;

      console.warn(
        "Could not read video metadata."
      );
    };

    metadataVideo.addEventListener(
      "loadedmetadata",
      handleMetadata
    );

    metadataVideo.addEventListener(
      "error",
      handleError
    );

    metadataVideo.src = videoURL;

    return () => {
      cancelled = true;

      metadataVideo.pause();
      metadataVideo.removeAttribute("src");
      metadataVideo.load();

      metadataVideo.removeEventListener(
        "loadedmetadata",
        handleMetadata
      );

      metadataVideo.removeEventListener(
        "error",
        handleError
      );
    };
  }, [videoURL, videoName]);

  // =========================================================
  // UPLOAD VIDEO
  // =========================================================

  const handleUploadVideo = useCallback(
    async (file) => {
      if (!file) return;

      // Stop old video.
      if (videoRef.current) {
        videoRef.current.pause();
      }

      setIsPlaying(false);

      // Revoke old object URL.
      setVideoURL((oldURL) => {
        if (oldURL) {
          URL.revokeObjectURL(oldURL);
        }

        return URL.createObjectURL(file);
      });

      setVideoFile(file);
      setVideoName(file.name);

      setCurrentTime(0);
      setDuration(0);

      setJobStatus("uploading");
      setJobError(null);
      setAnalysisData(null);
      setJobProgress(0);

      // Initial full-length clip.
      setClips([
        {
          id: `clip-${Date.now()}`,
          start: 0,
          end: 0,
          sourceStart: 0,
          sourceEnd: 0,
          name: file.name,
        },
      ]);

      setSelectedClipId(null);

      try {
        const result =
          await uploadVideo(
            file,
            (progressEvent) => {
              if (progressEvent.total) {
                setJobProgress(
                  Math.round(
                    (progressEvent.loaded /
                      progressEvent.total) *
                      50
                  )
                );
              }
            }
          );

        setJobId(result.run_id);

        setJobStatus(result.status);

        setJobProgress(60);

        addNotification(
          "info",
          "Video uploaded. Analysis started..."
        );
      } catch (err) {
        setJobStatus("failed");

        setJobError(err.message);

        addNotification(
          "error",
          `Upload failed: ${err.message}`
        );
      }
    },
    [addNotification]
  );

  // =========================================================
  // TIMELINE-AWARE SEEK
  //
  // The Timeline calls seek() using TIMELINE time.
  // We convert it to source-video time.
  // =========================================================

  const seek = useCallback(
    (timelineTime) => {
      const video = videoRef.current;

      if (!video || clips.length === 0) {
        return;
      }

      const timelineDuration =
        getTimelineDuration();

      const safeTimelineTime =
        Math.max(
          0,
          Math.min(
            Number(timelineTime) || 0,
            timelineDuration
          )
        );

      let clip =
        getClipAtTimelineTime(
          safeTimelineTime
        );

      // If user clicks in a gap, jump to
      // the next available clip.
      if (!clip) {
        const sorted =
          sortedClips(clips);

        clip =
          sorted.find(
            (item) =>
              Number(item.start) >
              safeTimelineTime
          ) || null;
      }

      if (!clip) {
        const last =
          sortedClips(clips).at(-1);

        if (!last) return;

        clip = last;
      }

      const clipStart =
        Number(clip.start) || 0;

      const clipEnd =
        Number(clip.end) || clipStart;

      const sourceStart =
        Number(clip.sourceStart) || 0;

      const offset = Math.max(
        0,
        Math.min(
          safeTimelineTime - clipStart,
          clipEnd - clipStart
        )
      );

      const sourceTime =
        sourceStart + offset;

      isInternalSeekRef.current = true;

      video.currentTime =
        Math.max(
          0,
          Math.min(
            sourceTime,
            video.duration || sourceTime
          )
        );

      setCurrentTime(
        clipStart + offset
      );

      setSelectedClipId(clip.id);

      // Reset on next event loop.
      setTimeout(() => {
        isInternalSeekRef.current =
          false;
      }, 0);
    },
    [
      clips,
      getTimelineDuration,
      getClipAtTimelineTime,
      sortedClips,
    ]
  );

  // =========================================================
  // PLAYBACK
  // =========================================================

  const togglePlay = useCallback(
    () => {
      const video = videoRef.current;

      if (!video || clips.length === 0) {
        return;
      }

      if (video.paused) {
        const timelineDuration =
          getTimelineDuration();

        let timelinePosition =
          currentTime;

        // If at the end, restart from beginning.
        if (
          timelinePosition >=
          timelineDuration - 0.01
        ) {
          timelinePosition = 0;
        }

        const clip =
          getClipAtTimelineTime(
            timelinePosition
          );

        // If we're in a gap, seek to next clip.
        if (!clip) {
          const sorted =
            sortedClips(clips);

          const next =
            sorted.find(
              (item) =>
                Number(item.end) >
                timelinePosition
            );

          if (next) {
            seek(Number(next.start) || 0);
          } else {
            seek(0);
          }
        } else {
          seek(timelinePosition);
        }

        // Wait for seek before playing.
        requestAnimationFrame(() => {
          videoRef.current
            ?.play()
            .catch(() => {});
        });
      } else {
        video.pause();
      }
    },
    [
      clips,
      currentTime,
      getTimelineDuration,
      getClipAtTimelineTime,
      sortedClips,
      seek,
    ]
  );

  // =========================================================
  // VIDEO TIME UPDATE
  //
  // This is the most important part.
  //
  // When the source video reaches the end of a clip,
  // automatically jump to the next timeline clip.
  // =========================================================

  const handleVideoTimeUpdate =
    useCallback(() => {
      const video =
        videoRef.current;

      if (
        !video ||
        clips.length === 0
      ) {
        return;
      }

      const sourceTime =
        video.currentTime;

      const sorted =
        sortedClips(clips);

      // Find clip containing the current SOURCE time.
      const activeClip =
        sorted.find((clip) => {
          const sourceStart =
            Number(
              clip.sourceStart
            ) || 0;

          const sourceEnd =
            Number(
              clip.sourceEnd
            ) || 0;

          return (
            sourceTime >=
              sourceStart &&
            sourceTime <
              sourceEnd
          );
        });

      // -----------------------------------------------------
      // We are inside a valid clip.
      // -----------------------------------------------------

      if (activeClip) {
        const timelineStart =
          Number(
            activeClip.start
          ) || 0;

        const sourceStart =
          Number(
            activeClip.sourceStart
          ) || 0;

        const timelineTime =
          timelineStart +
          (sourceTime -
            sourceStart);

        setCurrentTime(
          timelineTime
        );

        setSelectedClipId(
          activeClip.id
        );

        // Check whether we're extremely close
        // to the end of the source clip.
        const sourceEnd =
          Number(
            activeClip.sourceEnd
          ) || 0;

        if (
          sourceTime >=
            sourceEnd - 0.03
        ) {
          const nextClip =
            getNextClip(
              activeClip,
              sorted
            );

          if (nextClip) {
            // Jump to next clip.
            const nextSource =
              Number(
                nextClip.sourceStart
              ) || 0;

            isInternalSeekRef.current =
              true;

            video.currentTime =
              nextSource;

            setCurrentTime(
              Number(
                nextClip.start
              ) || 0
            );

            setSelectedClipId(
              nextClip.id
            );

            setTimeout(() => {
              isInternalSeekRef.current =
                false;
            }, 0);

            return;
          }

          // No next clip.
          video.pause();

          setIsPlaying(false);

          setCurrentTime(
            Number(
              activeClip.end
            ) || 0
          );

          return;
        }

        return;
      }

      // -----------------------------------------------------
      // Source time is NOT inside any clip.
      //
      // This can happen when:
      // - a section was deleted
      // - browser jumped across a cut
      // -----------------------------------------------------

      let nextClip =
        sorted.find((clip) => {
          const sourceStart =
            Number(
              clip.sourceStart
            ) || 0;

          return (
            sourceStart >
            sourceTime
          );
        });

      if (nextClip) {
        const nextSource =
          Number(
            nextClip.sourceStart
          ) || 0;

        isInternalSeekRef.current =
          true;

        video.currentTime =
          nextSource;

        setCurrentTime(
          Number(
            nextClip.start
          ) || 0
        );

        setSelectedClipId(
          nextClip.id
        );

        setTimeout(() => {
          isInternalSeekRef.current =
            false;
        }, 0);

        return;
      }

      video.pause();
      setIsPlaying(false);
    }, [
      clips,
      sortedClips,
      getNextClip,
    ]);

  // =========================================================
  // VIDEO LOADED METADATA
  // =========================================================

  const handleVideoLoadedMetadata =
    useCallback(() => {
      const video =
        videoRef.current;

      if (!video) return;

      const videoDuration =
        Number(video.duration);

      if (
        !Number.isFinite(
          videoDuration
        ) ||
        videoDuration <= 0
      ) {
        return;
      }

      setDuration(
        videoDuration
      );

      setClips((prevClips) => {
        if (
          prevClips.length === 0
        ) {
          return [
            {
              id: `clip-${Date.now()}`,
              start: 0,
              end: videoDuration,
              sourceStart: 0,
              sourceEnd: videoDuration,
              name: videoName,
            },
          ];
        }

        // Only update the initial
        // unsplit full-video clip.
        if (
          prevClips.length === 1
        ) {
          const clip =
            prevClips[0];

          if (
            Number(
              clip.sourceStart
            ) === 0
          ) {
            return [
              {
                ...clip,
                start: 0,
                end: videoDuration,
                sourceStart: 0,
                sourceEnd:
                  videoDuration,
              },
            ];
          }
        }

        return prevClips;
      });
    }, [videoName]);

  // =========================================================
  // VIDEO PLAY
  // =========================================================

  const handleVideoPlay =
    useCallback(() => {
      setIsPlaying(true);
    }, []);

  // =========================================================
  // VIDEO PAUSE
  // =========================================================

  const handleVideoPause =
    useCallback(() => {
      setIsPlaying(false);
    }, []);

  // =========================================================
  // FRAME STEP
  // =========================================================

  const stepFrame = useCallback(
    (direction) => {
      const video =
        videoRef.current;

      if (
        !video ||
        clips.length === 0
      ) {
        return;
      }

      const fps = 30;

      const frame =
        1 / fps;

      const nextTimeline =
        currentTime +
        direction * frame;

      const timelineDuration =
        getTimelineDuration();

      const safeTime =
        Math.max(
          0,
          Math.min(
            nextTimeline,
            timelineDuration
          )
        );

      seek(safeTime);

      video.pause();
    },
    [
      clips.length,
      currentTime,
      getTimelineDuration,
      seek,
    ]
  );

  // =========================================================
  // SPEED
  // =========================================================

  const changeSpeed =
    useCallback(
      (rate) => {
        const video =
          videoRef.current;

        if (!video) return;

        video.playbackRate =
          rate;

        setPlaybackRate(rate);
      },
      []
    );

  // =========================================================
  // VOLUME
  // =========================================================

  const setVolumeLevel =
    useCallback(
      (level) => {
        const safeLevel =
          Math.max(
            0,
            Math.min(1, level)
          );

        const video =
          videoRef.current;

        if (video) {
          video.volume =
            safeLevel;
        }

        setVolume(
          safeLevel
        );
      },
      []
    );

  // =========================================================
  // SPLIT CLIP
  //
  // timelineTime is the position where
  // the split happens.
  // =========================================================

  const splitClip =
    useCallback(
      (timelineTime) => {
        const clip =
          getClipAtTimelineTime(
            timelineTime
          );

        if (!clip) {
          return false;
        }

        const clipStart =
          Number(
            clip.start
          ) || 0;

        const clipEnd =
          Number(
            clip.end
          ) || 0;

        // Don't split too close to edges.
        if (
          timelineTime <=
            clipStart + 0.01 ||
          timelineTime >=
            clipEnd - 0.01
        ) {
          return false;
        }

        const sourceStart =
          Number(
            clip.sourceStart
          ) || 0;

        const splitOffset =
          timelineTime -
          clipStart;

        const sourceSplit =
          sourceStart +
          splitOffset;

        const leftClip = {
          ...clip,
          id: `clip-${Date.now()}-a`,
          start: clipStart,
          end: timelineTime,
          sourceStart,
          sourceEnd: sourceSplit,
        };

        const rightClip = {
          ...clip,
          id: `clip-${Date.now()}-b`,
          start: timelineTime,
          end: clipEnd,
          sourceStart: sourceSplit,
          sourceEnd:
            Number(
              clip.sourceEnd
            ) || sourceSplit,
        };

        setClips((prev) =>
          sortedClips(
            prev
              .filter(
                (item) =>
                  item.id !==
                  clip.id
              )
              .concat([
                leftClip,
                rightClip,
              ])
          )
        );

        setSelectedClipId(
          rightClip.id
        );

        return true;
      },
      [
        getClipAtTimelineTime,
        sortedClips,
      ]
    );

  // =========================================================
  // DELETE CLIP
  //
  // Important:
  // This does NOT delete the uploaded source video.
  // It only removes a timeline clip.
  //
  // Remaining clips are re-packed so there are no gaps.
  // =========================================================

  const deleteClip =
    useCallback(
      (clipId) => {
        setClips((prev) => {
          const target =
            prev.find(
              (clip) =>
                clip.id === clipId
            );

          if (!target) {
            return prev;
          }

          const remaining =
            prev.filter(
              (clip) =>
                clip.id !==
                clipId
            );

          // Re-pack timeline.
          let timelinePosition =
            0;

          const packed =
            sortedClips(
              remaining
            ).map((clip) => {
              const sourceStart =
                Number(
                  clip.sourceStart
                ) || 0;

              const sourceEnd =
                Number(
                  clip.sourceEnd
                ) || sourceStart;

              const clipDuration =
                Math.max(
                  0,
                  sourceEnd -
                    sourceStart
                );

              const newClip = {
                ...clip,

                start:
                  timelinePosition,

                end:
                  timelinePosition +
                  clipDuration,
              };

              timelinePosition +=
                clipDuration;

              return newClip;
            });

          return packed;
        });

        setSelectedClipId(
          null
        );

        return true;
      },
      [sortedClips]
    );

  // =========================================================
  // INSPECTOR
  // =========================================================

  const inspectItem =
    useCallback(
      (item) => {
        setSelectedItem(item);

        if (
          item?.time !==
          undefined
        ) {
          seek(item.time);
        }
      },
      [seek]
    );

  // =========================================================
  // CONTEXT VALUE
  // =========================================================

  const value = {
    // Video
    videoFile,
    videoURL,
    videoName,

    setVideoFile,
    setVideoURL,
    setVideoName,

    // Playback
    currentTime,
    setCurrentTime,

    duration,
    setDuration,

    isPlaying,
    setIsPlaying,

    volume,
    playbackRate,

    videoRef,

    // Playback events
    handleVideoLoadedMetadata,
    handleVideoTimeUpdate,
    handleVideoPlay,
    handleVideoPause,

    // Playback controls
    togglePlay,
    seek,
    stepFrame,
    changeSpeed,
    setVolumeLevel,

    // Timeline
    clips,
    setClips,

    selectedClipId,
    setSelectedClipId,

    // Timeline editing
    splitClip,
    deleteClip,

    // Timeline conversion helpers
    timelineToSourceTime,
    sourceToTimelineTime,
    getClipAtTimelineTime,
    getTimelineDuration,

    // AI
    jobId,
    jobStatus,
    jobProgress,
    jobError,

    analysisData,
    setAnalysisData,

    // Upload
    handleUploadVideo,

    // UI
    backendOnline,

    notifications,
    addNotification,
    removeNotification,

    activeSidebarTab,
    setActiveSidebarTab,

    activeInspectorTab,
    setActiveInspectorTab,

    selectedItem,
    setSelectedItem,

    inspectItem,

    zoom,
    setZoom,
  };

  return (
    <EditorContext.Provider
      value={value}
    >
      {children}
    </EditorContext.Provider>
  );
}

// ===========================================================
// USE EDITOR
// ===========================================================

export function useEditor() {
  const ctx =
    useContext(
      EditorContext
    );

  if (!ctx) {
    throw new Error(
      "useEditor must be used within EditorProvider"
    );
  }

  return ctx;
}