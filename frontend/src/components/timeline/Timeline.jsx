/**
 * VidClips - Timeline
 *
 * Matched to the current timeline-aware EditorContext.
 *
 * Features:
 * - Real video thumbnails
 * - Timeline-aware playhead
 * - Timeline-aware seeking
 * - Clip selection
 * - Split clips
 * - Delete clips
 * - Restore deleted clips
 * - Scene markers
 * - Zoom
 * - Audio waveform
 * - Keyboard shortcuts
 *
 * IMPORTANT:
 * currentTime from EditorContext is TIMELINE time.
 * seek() from EditorContext also expects TIMELINE time.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ZoomIn,
  ZoomOut,
  Scissors,
  Video,
  Music,
  Image,
  Trash2,
  RotateCcw,
} from "lucide-react";

import { useEditor } from "../../context/EditorContext";

const TRACK_HEIGHT = 72;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

const THUMBNAIL_WIDTH = 96;
const THUMBNAIL_HEIGHT = 54;

const MIN_CLIP_DURATION = 0.05;

export default function Timeline() {
  const {
    currentTime,
    duration,
    seek,

    zoom,
    setZoom,

    analysisData,
    videoURL,

    clips,
    setClips,

    selectedClipId,
    setSelectedClipId,

    splitClip,
    deleteClip,
  } = useEditor();

  const timelineRef = useRef(null);

  const dragRef = useRef({
    dragging: false,
    moved: false,
  });

  const [isDragging, setIsDragging] = useState(false);

  const [thumbnails, setThumbnails] = useState([]);

  const [thumbnailLoading, setThumbnailLoading] =
    useState(false);

  /*
   * Local restore stack.
   *
   * EditorContext already owns the real clips.
   * This stack only remembers deleted clips so that
   * Timeline can restore the last deletion.
   */
  const [deletedClips, setDeletedClips] =
    useState([]);

  /*
   * =========================================================
   * ZOOM
   * =========================================================
   */

  const safeZoom = useMemo(() => {
    const value = Number(zoom);

    if (!Number.isFinite(value)) {
      return 1;
    }

    return Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, value)
    );
  }, [zoom]);

  const pxPerSec = 80 * safeZoom;

  const zoomIn = useCallback(() => {
    setZoom((value) => {
      const current = Number(value) || 1;

      return Math.min(
        current + 0.25,
        MAX_ZOOM
      );
    });
  }, [setZoom]);

  const zoomOut = useCallback(() => {
    setZoom((value) => {
      const current = Number(value) || 1;

      return Math.max(
        current - 0.25,
        MIN_ZOOM
      );
    });
  }, [setZoom]);

  /*
   * =========================================================
   * SORTED CLIPS
   * =========================================================
   */

  const sortedClips = useMemo(() => {
    if (!Array.isArray(clips)) {
      return [];
    }

    return [...clips]
      .filter((clip) => {
        if (!clip) {
          return false;
        }

        const start = Number(clip.start);
        const end = Number(clip.end);

        return (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          end > start
        );
      })
      .sort(
        (a, b) =>
          Number(a.start) -
          Number(b.start)
      );
  }, [clips]);

  /*
   * =========================================================
   * TIMELINE DURATION
   *
   * currentTime and seek() use timeline time.
   * Therefore the timeline duration is the end of the
   * last timeline clip.
   * =========================================================
   */

  const timelineDuration = useMemo(() => {
    if (sortedClips.length === 0) {
      return 0;
    }

    return Math.max(
      ...sortedClips.map(
        (clip) =>
          Number(clip.end) || 0
      )
    );
  }, [sortedClips]);

  const totalWidth = Math.max(
    timelineDuration * pxPerSec,
    800
  );

  /*
   * =========================================================
   * PLAYHEAD
   *
   * IMPORTANT:
   * currentTime is ALREADY timeline time.
   *
   * Do NOT call sourceToTimelineTime(currentTime).
   * =========================================================
   */

  const timelineCurrentTime = Math.max(
    0,
    Math.min(
      Number(currentTime) || 0,
      timelineDuration
    )
  );

  const playheadX =
    timelineCurrentTime * pxPerSec;

  /*
   * =========================================================
   * SCENES
   * =========================================================
   */

  const scenes = useMemo(() => {
    if (
      !analysisData ||
      !Array.isArray(
        analysisData.scenes
      )
    ) {
      return [];
    }

    return analysisData.scenes;
  }, [analysisData]);

  /*
   * =========================================================
   * SOURCE -> TIMELINE
   *
   * Only needed for AI scene markers because scene times
   * come from the original source video.
   *
   * This does NOT convert currentTime.
   * =========================================================
   */

  const sourceToTimeline = useCallback(
    (sourceTime) => {
      const source =
        Number(sourceTime) || 0;

      for (const clip of sortedClips) {
        const sourceStart =
          Number(
            clip.sourceStart
          ) || 0;

        const sourceEnd =
          Number(
            clip.sourceEnd
          ) || 0;

        const timelineStart =
          Number(
            clip.start
          ) || 0;

        const timelineEnd =
          Number(
            clip.end
          ) || timelineStart;

        if (
          source >= sourceStart &&
          source <= sourceEnd
        ) {
          const offset =
            source - sourceStart;

          return Math.max(
            timelineStart,
            Math.min(
              timelineStart + offset,
              timelineEnd
            )
          );
        }
      }

      /*
       * If the scene is inside a deleted source section,
       * put its marker at the nearest available timeline
       * position.
       */

      for (const clip of sortedClips) {
        const sourceStart =
          Number(
            clip.sourceStart
          ) || 0;

        if (source < sourceStart) {
          return (
            Number(clip.start) || 0
          );
        }
      }

      return timelineDuration;
    },
    [
      sortedClips,
      timelineDuration,
    ]
  );

  /*
   * =========================================================
   * TIME MARKERS
   * =========================================================
   */

  const timeMarkers = useMemo(() => {
    if (
      !timelineDuration ||
      timelineDuration <= 0
    ) {
      return [];
    }

    let step = 1;

    if (timelineDuration > 30) {
      step = 2;
    }

    if (timelineDuration > 60) {
      step = 5;
    }

    if (timelineDuration > 180) {
      step = 10;
    }

    if (timelineDuration > 600) {
      step = 30;
    }

    const markers = [];

    for (
      let time = 0;
      time <= timelineDuration;
      time += step
    ) {
      markers.push(
        Number(time.toFixed(3))
      );
    }

    return markers;
  }, [timelineDuration]);

  /*
   * =========================================================
   * FORMAT TIME
   * =========================================================
   */

  const formatTime = useCallback(
    (time) => {
      if (
        !Number.isFinite(Number(time)) ||
        Number(time) < 0
      ) {
        return "0:00";
      }

      const value = Number(time);

      const hours =
        Math.floor(value / 3600);

      const minutes =
        Math.floor(
          (value % 3600) / 60
        );

      const seconds =
        Math.floor(value % 60);

      if (hours > 0) {
        return `${hours}:${String(
          minutes
        ).padStart(2, "0")}:${String(
          seconds
        ).padStart(2, "0")}`;
      }

      return `${minutes}:${String(
        seconds
      ).padStart(2, "0")}`;
    },
    []
  );

  /*
   * =========================================================
   * VIDEO THUMBNAILS
   *
   * Important performance improvement:
   *
   * Thumbnails are generated from the source video only.
   * Zooming the timeline does NOT regenerate them.
   *
   * This avoids a major source of lag.
   * =========================================================
   */

  useEffect(() => {
    if (
      !videoURL ||
      !duration ||
      duration <= 0
    ) {
      setThumbnails([]);
      setThumbnailLoading(false);
      return;
    }

    let cancelled = false;

    const video =
      document.createElement("video");

    const canvas =
      document.createElement("canvas");

    video.src = videoURL;

    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    canvas.width =
      THUMBNAIL_WIDTH * 2;

    canvas.height =
      THUMBNAIL_HEIGHT * 2;

    const ctx =
      canvas.getContext("2d", {
        alpha: false,
      });

    if (!ctx) {
      return;
    }

    const generate =
      async () => {
        setThumbnailLoading(true);
        setThumbnails([]);

        try {
          /*
           * Wait for metadata.
           */

          await new Promise(
            (resolve, reject) => {
              if (
                video.readyState >= 1
              ) {
                resolve();
                return;
              }

              const loaded =
                () => {
                  cleanup();
                  resolve();
                };

              const failed =
                () => {
                  cleanup();
                  reject(
                    new Error(
                      "Could not load video metadata"
                    )
                  );
                };

              const cleanup =
                () => {
                  video.removeEventListener(
                    "loadedmetadata",
                    loaded
                  );

                  video.removeEventListener(
                    "error",
                    failed
                  );
                };

              video.addEventListener(
                "loadedmetadata",
                loaded
              );

              video.addEventListener(
                "error",
                failed
              );
            }
          );

          if (cancelled) {
            return;
          }

          /*
           * Keep the thumbnail count reasonable.
           *
           * This is deliberately capped to prevent the
           * timeline from becoming CPU-heavy.
           */

          const count = Math.max(
            8,
            Math.min(
              Math.ceil(
                duration * 0.75
              ),
              80
            )
          );

          const generated = [];

          for (
            let index = 0;
            index < count;
            index++
          ) {
            if (cancelled) {
              return;
            }

            const time =
              count === 1
                ? 0
                : (index /
                    (count - 1)) *
                  Math.max(
                    duration - 0.05,
                    0
                  );

            /*
             * Seek source video.
             */

            await new Promise(
              (resolve) => {
                let finished = false;

                const finish =
                  () => {
                    if (finished) {
                      return;
                    }

                    finished = true;

                    video.removeEventListener(
                      "seeked",
                      finish
                    );

                    resolve();
                  };

                video.addEventListener(
                  "seeked",
                  finish,
                  {
                    once: true,
                  }
                );

                try {
                  video.currentTime =
                    time;

                  /*
                   * Some videos/browsers may already
                   * be at almost the same timestamp.
                   */

                  if (
                    Math.abs(
                      video.currentTime -
                        time
                    ) < 0.01
                  ) {
                    setTimeout(
                      finish,
                      20
                    );
                  }
                } catch {
                  finish();
                }
              }
            );

            if (cancelled) {
              return;
            }

            try {
              /*
               * Clear canvas.
               */

              ctx.fillStyle =
                "#111827";

              ctx.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
              );

              /*
               * Preserve aspect ratio.
               */

              const videoWidth =
                video.videoWidth || 16;

              const videoHeight =
                video.videoHeight || 9;

              const canvasRatio =
                canvas.width /
                canvas.height;

              const videoRatio =
                videoWidth /
                videoHeight;

              let drawWidth =
                canvas.width;

              let drawHeight =
                canvas.height;

              let offsetX = 0;
              let offsetY = 0;

              if (
                videoRatio >
                canvasRatio
              ) {
                drawHeight =
                  canvas.width /
                  videoRatio;

                offsetY =
                  (canvas.height -
                    drawHeight) /
                  2;
              } else {
                drawWidth =
                  canvas.height *
                  videoRatio;

                offsetX =
                  (canvas.width -
                    drawWidth) /
                  2;
              }

              ctx.drawImage(
                video,
                offsetX,
                offsetY,
                drawWidth,
                drawHeight
              );

              const image =
                canvas.toDataURL(
                  "image/jpeg",
                  0.58
                );

              generated.push({
                time,
                image,
              });

              /*
               * Progressive rendering.
               */

              setThumbnails([
                ...generated,
              ]);
            } catch {
              /*
               * Ignore individual frame failures.
               */
            }
          }
        } catch (error) {
          console.error(
            "Thumbnail generation failed:",
            error
          );
        } finally {
          if (!cancelled) {
            setThumbnailLoading(false);
          }
        }
      };

    generate();

    return () => {
      cancelled = true;

      video.pause();

      video.removeAttribute(
        "src"
      );

      video.load();
    };
  }, [videoURL, duration]);

  /*
   * =========================================================
   * MOUSE -> TIMELINE TIME
   * =========================================================
   */

  const getTimelineTimeFromMouse =
    useCallback(
      (event) => {
        if (
          !timelineRef.current
        ) {
          return 0;
        }

        const rect =
          timelineRef.current.getBoundingClientRect();

        const x =
          event.clientX -
          rect.left +
          timelineRef.current
            .scrollLeft;

        return Math.max(
          0,
          Math.min(
            x / pxPerSec,
            timelineDuration
          )
        );
      },
      [
        pxPerSec,
        timelineDuration,
      ]
    );

  /*
   * =========================================================
   * FIND CLIP
   * =========================================================
   */

  const findClipAtTime =
    useCallback(
      (time) => {
        return (
          sortedClips.find(
            (clip) => {
              const start =
                Number(
                  clip.start
                ) || 0;

              const end =
                Number(
                  clip.end
                ) || 0;

              return (
                time >= start &&
                time < end
              );
            }
          ) || null
        );
      },
      [sortedClips]
    );

  /*
   * =========================================================
   * TIMELINE SEEK
   *
   * IMPORTANT:
   *
   * EditorContext.seek() already expects timeline time.
   *
   * DO NOT convert this to source time here.
   * =========================================================
   */

  const seekTimeline =
    useCallback(
      (timelineTime) => {
        const safeTime =
          Math.max(
            0,
            Math.min(
              Number(
                timelineTime
              ) || 0,
              timelineDuration
            )
          );

        const clip =
          findClipAtTime(
            safeTime
          );

        if (clip) {
          setSelectedClipId(
            clip.id
          );
        }

        seek(safeTime);
      },
      [
        timelineDuration,
        findClipAtTime,
        seek,
        setSelectedClipId,
      ]
    );

  /*
   * =========================================================
   * MOUSE DOWN / DRAG
   * =========================================================
   */

  const handleMouseDown =
    useCallback(
      (event) => {
        if (
          timelineDuration <= 0
        ) {
          return;
        }

        /*
         * Don't drag from buttons.
         */

        if (
          event.target.closest(
            "button"
          )
        ) {
          return;
        }

        /*
         * Don't start timeline dragging if the
         * click is directly on a clip.
         * Clip handler will handle it.
         */

        if (
          event.target.closest(
            "[data-timeline-clip]"
          )
        ) {
          return;
        }

        dragRef.current = {
          dragging: true,
          moved: false,
        };

        setIsDragging(true);

        const initialTime =
          getTimelineTimeFromMouse(
            event
          );

        seekTimeline(
          initialTime
        );

        const move =
          (moveEvent) => {
            dragRef.current.moved =
              true;

            const time =
              getTimelineTimeFromMouse(
                moveEvent
              );

            seekTimeline(time);
          };

        const up = () => {
          dragRef.current.dragging =
            false;

          setIsDragging(false);

          document.removeEventListener(
            "mousemove",
            move
          );

          document.removeEventListener(
            "mouseup",
            up
          );
        };

        document.addEventListener(
          "mousemove",
          move
        );

        document.addEventListener(
          "mouseup",
          up
        );
      },
      [
        timelineDuration,
        getTimelineTimeFromMouse,
        seekTimeline,
      ]
    );

  /*
   * =========================================================
   * CLIP SELECTION + SEEK
   * =========================================================
   */

  const handleClipMouseDown =
    useCallback(
      (event, clip) => {
        event.stopPropagation();

        if (
          event.button !== 0
        ) {
          return;
        }

        setSelectedClipId(
          clip.id
        );

        const rect =
          event.currentTarget.getBoundingClientRect();

        const move =
          (moveEvent) => {
            const localX =
              moveEvent.clientX -
              rect.left;

            const ratio =
              Math.max(
                0,
                Math.min(
                  1,
                  localX /
                    Math.max(
                      rect.width,
                      1
                    )
                )
              );

            const clipStart =
              Number(
                clip.start
              ) || 0;

            const clipEnd =
              Number(
                clip.end
              ) || clipStart;

            const time =
              clipStart +
              ratio *
                (clipEnd -
                  clipStart);

            seekTimeline(time);
          };

        const up =
          (upEvent) => {
            const localX =
              upEvent.clientX -
              rect.left;

            const ratio =
              Math.max(
                0,
                Math.min(
                  1,
                  localX /
                    Math.max(
                      rect.width,
                      1
                    )
                )
              );

            const clipStart =
              Number(
                clip.start
              ) || 0;

            const clipEnd =
              Number(
                clip.end
              ) || clipStart;

            const time =
              clipStart +
              ratio *
                (clipEnd -
                  clipStart);

            seekTimeline(time);

            document.removeEventListener(
              "mousemove",
              move
            );

            document.removeEventListener(
              "mouseup",
              up
            );

            setIsDragging(false);
          };

        setIsDragging(true);

        document.addEventListener(
          "mousemove",
          move
        );

        document.addEventListener(
          "mouseup",
          up
        );

        seekTimeline(
          Number(clip.start) || 0
        );
      },
      [
        seekTimeline,
        setSelectedClipId,
      ]
    );

  /*
   * =========================================================
   * SPLIT
   *
   * Uses EditorContext.splitClip().
   * That keeps the actual timeline/source relationship
   * in one place.
   * =========================================================
   */

  const splitSelectedClip =
    useCallback(() => {
      if (
        !selectedClipId
      ) {
        return;
      }

      const selected =
        sortedClips.find(
          (clip) =>
            clip.id ===
            selectedClipId
        );

      if (!selected) {
        return;
      }

      const start =
        Number(
          selected.start
        ) || 0;

      const end =
        Number(
          selected.end
        ) || 0;

      const playhead =
        timelineCurrentTime;

      if (
        playhead <=
          start +
            MIN_CLIP_DURATION ||
        playhead >=
          end -
            MIN_CLIP_DURATION
      ) {
        return;
      }

      /*
       * Prefer the EditorContext implementation.
       */

      if (
        typeof splitClip ===
        "function"
      ) {
        const success =
          splitClip(
            playhead
          );

        if (success !== false) {
          return;
        }
      }

      /*
       * Fallback for compatibility.
       */

      const sourceStart =
        Number(
          selected.sourceStart
        ) || 0;

      const sourceEnd =
        Number(
          selected.sourceEnd
        ) || sourceStart;

      const offset =
        playhead - start;

      const sourceSplit =
        sourceStart +
        offset;

      const leftClip = {
        ...selected,

        id: `${selected.id}-left-${Date.now()}`,

        start,
        end: playhead,

        sourceStart,
        sourceEnd:
          sourceSplit,

        name:
          `${selected.name || "Clip"} - 1`,
      };

      const rightClip = {
        ...selected,

        id: `${selected.id}-right-${Date.now()}`,

        start: playhead,
        end,

        sourceStart:
          sourceSplit,

        sourceEnd,

        name:
          `${selected.name || "Clip"} - 2`,
      };

      setClips(
        (previous) =>
          previous.flatMap(
            (clip) =>
              clip.id ===
              selected.id
                ? [
                    leftClip,
                    rightClip,
                  ]
                : [clip]
          )
      );

      setSelectedClipId(
        rightClip.id
      );
    }, [
      selectedClipId,
      sortedClips,
      timelineCurrentTime,
      splitClip,
      setClips,
      setSelectedClipId,
    ]);

  /*
   * =========================================================
   * DELETE
   * =========================================================
   */

  const deleteSelectedClip =
    useCallback(() => {
      if (
        !selectedClipId
      ) {
        return;
      }

      const selected =
        sortedClips.find(
          (clip) =>
            clip.id ===
            selectedClipId
        );

      if (!selected) {
        return;
      }

      /*
       * Save a copy for restore.
       */

      setDeletedClips(
        (previous) => [
          ...previous,
          {
            ...selected,
            deletedAt:
              Date.now(),
          },
        ]
      );

      /*
       * Prefer EditorContext.deleteClip().
       *
       * It already repacks the remaining clips.
       */

      if (
        typeof deleteClip ===
        "function"
      ) {
        deleteClip(
          selectedClipId
        );

        /*
         * Select the nearest remaining clip after
         * React state updates.
         */

        const remaining =
          sortedClips.filter(
            (clip) =>
              clip.id !==
              selectedClipId
          );

        if (
          remaining.length > 0
        ) {
          const next =
            remaining.find(
              (clip) =>
                Number(
                  clip.start
                ) >=
                Number(
                  selected.start
                )
            ) ||
            remaining[
              remaining.length -
                1
            ];

          setSelectedClipId(
            next.id
          );

          /*
           * IMPORTANT:
           * seek() takes timeline time.
           */

          seek(
            Number(next.start) ||
              0
          );
        } else {
          setSelectedClipId(
            null
          );

          seek(0);
        }

        return;
      }

      /*
       * Fallback.
       */

      const remaining =
        sortedClips.filter(
          (clip) =>
            clip.id !==
            selectedClipId
        );

      let position = 0;

      const packed =
        remaining.map(
          (clip) => {
            const sourceStart =
              Number(
                clip.sourceStart
              ) || 0;

            const sourceEnd =
              Number(
                clip.sourceEnd
              ) ||
              sourceStart;

            const clipDuration =
              Math.max(
                0,
                sourceEnd -
                  sourceStart
              );

            const result = {
              ...clip,

              start:
                position,

              end:
                position +
                clipDuration,
            };

            position +=
              clipDuration;

            return result;
          }
        );

      setClips(packed);

      if (
        packed.length > 0
      ) {
        setSelectedClipId(
          packed[0].id
        );

        seek(0);
      } else {
        setSelectedClipId(
          null
        );

        seek(0);
      }
    }, [
      selectedClipId,
      sortedClips,
      deleteClip,
      setClips,
      setSelectedClipId,
      seek,
    ]);

  /*
   * =========================================================
   * RESTORE
   * =========================================================
   */

  const restoreLastDeleted =
    useCallback(() => {
      if (
        deletedClips.length ===
        0
      ) {
        return;
      }

      const restored =
        deletedClips[
          deletedClips.length -
            1
        ];

      /*
       * Don't restore a duplicate.
       */

      if (
        sortedClips.some(
          (clip) =>
            clip.id ===
            restored.id
        )
      ) {
        setDeletedClips(
          (previous) =>
            previous.slice(
              0,
              -1
            )
        );

        return;
      }

      const cleanClip = {
        ...restored,
      };

      delete cleanClip.deletedAt;

      /*
       * Insert the restored clip according to SOURCE order.
       *
       * This is important because EditorContext's deleteClip()
       * repacks the remaining clips.
       */

      setClips(
        (previous) => {
          const combined = [
            ...previous,
            cleanClip,
          ];

          const sourceSorted =
            combined.sort(
              (a, b) =>
                (Number(
                  a.sourceStart
                ) || 0) -
                (Number(
                  b.sourceStart
                ) || 0)
            );

          let position = 0;

          return sourceSorted.map(
            (clip) => {
              const sourceStart =
                Number(
                  clip.sourceStart
                ) || 0;

              const sourceEnd =
                Number(
                  clip.sourceEnd
                ) ||
                sourceStart;

              const clipDuration =
                Math.max(
                  0,
                  sourceEnd -
                    sourceStart
                );

              const result = {
                ...clip,

                start:
                  position,

                end:
                  position +
                  clipDuration,
              };

              position +=
                clipDuration;

              return result;
            }
          );
        }
      );

      setDeletedClips(
        (previous) =>
          previous.slice(
            0,
            -1
          )
      );

      setSelectedClipId(
        cleanClip.id
      );

      /*
       * We cannot reliably know the new packed timeline
       * position until React applies the state.
       *
       * Selecting the restored clip is enough; playback can
       * then seek to it on the next interaction.
       */
    }, [
      deletedClips,
      sortedClips,
      setClips,
      setSelectedClipId,
    ]);

  /*
   * =========================================================
   * KEYBOARD SHORTCUTS
   * =========================================================
   */

  useEffect(() => {
    const handleKeyDown =
      (event) => {
        const target =
          event.target;

        if (
          target instanceof
            HTMLInputElement ||
          target instanceof
            HTMLTextAreaElement ||
          target?.isContentEditable
        ) {
          return;
        }

        /*
         * S = split
         */

        if (
          event.key.toLowerCase() ===
          "s"
        ) {
          event.preventDefault();

          splitSelectedClip();

          return;
        }

        /*
         * Delete / Backspace
         */

        if (
          event.key ===
            "Delete" ||
          event.key ===
            "Backspace"
        ) {
          if (
            selectedClipId
          ) {
            event.preventDefault();

            deleteSelectedClip();
          }

          return;
        }

        /*
         * Ctrl + Z = restore
         */

        if (
          event.ctrlKey &&
          event.key.toLowerCase() ===
            "z"
        ) {
          event.preventDefault();

          restoreLastDeleted();
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    splitSelectedClip,
    deleteSelectedClip,
    restoreLastDeleted,
    selectedClipId,
  ]);

  /*
   * =========================================================
   * TRACKS
   * =========================================================
   */

  const tracks = [
    {
      id: "video",
      label: "Video",
      icon: Video,
    },
    {
      id: "audio",
      label: "Audio",
      icon: Music,
    },
    {
      id: "scenes",
      label: "Scenes",
      icon: Image,
    },
  ];

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div className="h-64 bg-[#0B1120] border-t border-zinc-800/60 flex flex-col shrink-0">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="h-[44px] shrink-0 border-b border-zinc-800/40 flex items-center justify-between px-4 bg-[#0F172A]">

        <div className="flex items-center gap-3">

          <h2 className="text-sm font-semibold text-zinc-200">
            Timeline
          </h2>

          {/* Zoom */}

          <div className="flex items-center gap-1">

            <button
              onClick={
                zoomOut
              }
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Zoom out"
            >
              <ZoomOut
                size={14}
              />
            </button>

            <span className="text-[11px] text-zinc-500 w-10 text-center tabular-nums">
              {Math.round(
                safeZoom * 100
              )}
              %
            </span>

            <button
              onClick={
                zoomIn
              }
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Zoom in"
            >
              <ZoomIn
                size={14}
              />
            </button>

          </div>

          {thumbnailLoading && (
            <span className="text-[10px] text-zinc-600">
              Generating thumbnails...
            </span>
          )}

        </div>

        {/* Actions */}

        <div className="flex items-center gap-1">

          <button
            onClick={
              splitSelectedClip
            }
            disabled={
              !selectedClipId
            }
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Split clip (S)"
          >
            <Scissors
              size={14}
            />
          </button>

          <button
            onClick={
              deleteSelectedClip
            }
            disabled={
              !selectedClipId
            }
            className="p-1.5 rounded hover:bg-red-500/10 text-zinc-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Delete clip (Delete)"
          >
            <Trash2
              size={14}
            />
          </button>

          <button
            onClick={
              restoreLastDeleted
            }
            disabled={
              deletedClips.length ===
              0
            }
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Restore deleted clip (Ctrl+Z)"
          >
            <RotateCcw
              size={14}
            />
          </button>

          <div className="ml-2 pl-2 border-l border-zinc-800">

            <span className="text-[11px] text-zinc-400 tabular-nums">
              {formatTime(
                timelineCurrentTime
              )}

              {" / "}

              {formatTime(
                timelineDuration
              )}
            </span>

          </div>

        </div>

      </div>

      {/* =====================================================
          TIMELINE BODY
          ===================================================== */}

      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ===================================================
            LABELS
            =================================================== */}

        <div className="w-[100px] shrink-0 border-r border-zinc-800/40 bg-[#0D1424]">

          <div className="h-6 border-b border-zinc-800/40" />

          {tracks.map(
            (track) => {
              const Icon =
                track.icon;

              return (
                <div
                  key={
                    track.id
                  }
                  className="flex items-center gap-2 px-3 border-b border-zinc-800/20"
                  style={{
                    height:
                      TRACK_HEIGHT,
                  }}
                >
                  <Icon
                    size={14}
                    className="text-zinc-500"
                  />

                  <span className="text-[11px] text-zinc-500 font-medium">
                    {
                      track.label
                    }
                  </span>
                </div>
              );
            }
          )}

        </div>

        {/* ===================================================
            SCROLLABLE TIMELINE
            =================================================== */}

        <div
          ref={
            timelineRef
          }
          className={`flex-1 overflow-x-auto overflow-y-hidden relative ${
            isDragging
              ? "cursor-col-resize"
              : "cursor-pointer"
          }`}
          onMouseDown={
            handleMouseDown
          }
        >

          <div
            className="relative"
            style={{
              width:
                totalWidth,

              minWidth:
                "100%",

              height:
                24 +
                TRACK_HEIGHT *
                  tracks.length,
            }}
          >

            {/* ===============================================
                TIME RULER
                =============================================== */}

            <div className="h-6 border-b border-zinc-800/40 bg-[#0D1424] relative">

              {timeMarkers.map(
                (time) => (
                  <div
                    key={
                      time
                    }
                    className="absolute top-0 h-full"
                    style={{
                      left:
                        time *
                        pxPerSec,
                    }}
                  >

                    <div className="h-2 w-px bg-zinc-700" />

                    <span className="absolute left-1 top-2 text-[9px] text-zinc-600 whitespace-nowrap">
                      {formatTime(
                        time
                      )}
                    </span>

                  </div>
                )
              )}

            </div>

            {/* ===============================================
                VIDEO TRACK
                =============================================== */}

            <div
              className="relative border-b border-zinc-800/20 bg-[#0B1120]"
              style={{
                height:
                  TRACK_HEIGHT,
              }}
            >

              {sortedClips.map(
                (clip) => {
                  const clipStart =
                    Number(
                      clip.start
                    ) || 0;

                  const clipEnd =
                    Number(
                      clip.end
                    ) || 0;

                  const clipDuration =
                    Math.max(
                      0,
                      clipEnd -
                        clipStart
                    );

                  const clipWidth =
                    Math.max(
                      clipDuration *
                        pxPerSec,
                      8
                    );

                  const isSelected =
                    clip.id ===
                    selectedClipId;

                  const sourceStart =
                    Number(
                      clip.sourceStart
                    ) || 0;

                  const sourceEnd =
                    Number(
                      clip.sourceEnd
                    ) ||
                    sourceStart;

                  /*
                   * Thumbnails belonging to this source range.
                   */

                  const clipThumbnails = getClipThumbnails(
                    thumbnails,
                    sourceStart,
                    sourceEnd,
                    clipWidth
                  );

                  return (
                    <div
                      key={
                        clip.id
                      }
                      data-timeline-clip
                      className={`absolute top-1 bottom-1 rounded-md overflow-hidden border cursor-pointer select-none transition-all ${
                        isSelected
                          ? "border-blue-400 ring-1 ring-blue-400/60 bg-blue-500/20"
                          : "border-blue-500/30 bg-blue-500/10 hover:border-blue-400/60"
                      }`}
                      style={{
                        left:
                          clipStart *
                          pxPerSec,

                        width:
                          clipWidth,
                      }}
                      onMouseDown={(
                        event
                      ) =>
                        handleClipMouseDown(
                          event,
                          clip
                        )
                      }
                    >

                      {/* -------------------------------------
                          THUMBNAILS
                          ------------------------------------- */}

                      <div className="absolute inset-0 overflow-hidden">

                        {clipThumbnails.map(
                          (
                            thumbnail,
                            index
                          ) => {
                            /*
                             * Position frames evenly across the visible clip.
                             * This is important when a short split clip uses a
                             * nearest-frame fallback from just outside its source
                             * range. Using the raw source timestamp here would pin
                             * that fallback to an edge and leave the clip blank.
                             */
                            const ratio =
                              clipThumbnails.length === 1
                                ? 0.5
                                : index /
                                  Math.max(
                                    clipThumbnails.length - 1,
                                    1
                                  );

                            return (
                              <img
                                key={`${clip.id}-${thumbnail.time}-${index}`}
                                src={
                                  thumbnail.image
                                }
                                alt=""
                                draggable={
                                  false
                                }
                                className="absolute top-0 h-full object-cover pointer-events-none"
                                style={{
                                  width:
                                    THUMBNAIL_WIDTH,

                                  left:
                                    ratio *
                                      clipWidth -
                                    THUMBNAIL_WIDTH /
                                      2,
                                }}
                              />
                            );
                          }
                        )}

                        {clipThumbnails.length ===
                          0 && (
                          <div className="absolute inset-0 flex items-center justify-center">

                            {thumbnailLoading ? (
                              <span className="text-[9px] text-zinc-600">
                                Loading preview...
                              </span>
                            ) : (
                              <span className="text-[9px] text-zinc-700">
                                Video
                              </span>
                            )}

                          </div>
                        )}

                      </div>

                      {/* Dark overlay */}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                      {/* Clip name */}

                      <div className="absolute top-1 left-1 right-1 pointer-events-none">

                        <span className="text-[9px] text-white/85 bg-black/45 px-1.5 py-0.5 rounded">
                          {clip.name ||
                            "Video Clip"}
                        </span>

                      </div>

                      {/* Source range */}

                      <span className="absolute bottom-1 left-1 text-[8px] text-white/70 bg-black/45 px-1 rounded pointer-events-none">

                        {formatTime(
                          sourceStart
                        )}

                        {" - "}

                        {formatTime(
                          sourceEnd
                        )}

                      </span>

                      {/* Selection edges */}

                      {isSelected && (
                        <>
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 pointer-events-none" />

                          <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-400 pointer-events-none" />
                        </>
                      )}

                    </div>
                  );
                }
              )}

              {/* Empty timeline */}

              {sortedClips.length ===
                0 && (
                <div className="absolute inset-0 flex items-center justify-center">

                  <span className="text-[10px] text-zinc-700">
                    No clips in timeline
                  </span>

                </div>
              )}

              {/* Scene overlays */}

              {scenes.map(
                (
                  scene,
                  index
                ) => {
                  const sourceStart =
                    Number(
                      scene.start_sec
                    ) || 0;

                  const sourceEnd =
                    Number(
                      scene.end_sec
                    ) ||
                    sourceStart;

                  const timelineStart =
                    sourceToTimeline(
                      sourceStart
                    );

                  const timelineEnd =
                    sourceToTimeline(
                      sourceEnd
                    );

                  const width =
                    Math.max(
                      (
                        timelineEnd -
                        timelineStart
                      ) *
                        pxPerSec,
                      2
                    );

                  return (
                    <div
                      key={`scene-${index}`}
                      className="absolute top-1 bottom-1 border-l border-purple-400/60 pointer-events-none"
                      style={{
                        left:
                          timelineStart *
                          pxPerSec,

                        width,
                      }}
                    >

                      <div className="absolute top-0 left-0 px-1 py-0.5 text-[8px] text-purple-300 bg-purple-500/30 rounded-br">
                        Scene{" "}
                        {index +
                          1}
                      </div>

                    </div>
                  );
                }
              )}

            </div>

            {/* ===============================================
                AUDIO TRACK
                =============================================== */}

            <div
              className="relative border-b border-zinc-800/20 bg-[#0B1120]"
              style={{
                height:
                  TRACK_HEIGHT,
              }}
            >

              <div className="absolute inset-0 flex items-center overflow-hidden opacity-40">

                {Array.from(
                  {
                    length:
                      Math.min(
                        Math.ceil(
                          totalWidth /
                            5
                        ),
                        500
                      ),
                  }
                ).map(
                  (_, index) => {
                    const wave =
                      Math.abs(
                        Math.sin(
                          index *
                            0.73
                        )
                      );

                    const height =
                      15 +
                      wave * 65;

                    return (
                      <div
                        key={
                          index
                        }
                        className="w-[2px] shrink-0 mx-[1px] bg-emerald-400 rounded-full"
                        style={{
                          height: `${height}%`,
                        }}
                      />
                    );
                  }
                )}

              </div>

            </div>

            {/* ===============================================
                SCENES TRACK
                =============================================== */}

            <div
              className="relative border-b border-zinc-800/20 bg-[#0B1120]"
              style={{
                height:
                  TRACK_HEIGHT,
              }}
            >

              {scenes.map(
                (
                  scene,
                  index
                ) => {
                  const sourceStart =
                    Number(
                      scene.start_sec
                    ) || 0;

                  const timelineStart =
                    sourceToTimeline(
                      sourceStart
                    );

                  return (
                    <div
                      key={`marker-${index}`}
                      className="absolute top-0 bottom-0 border-l-2 border-purple-500/50 cursor-pointer"
                      style={{
                        left:
                          timelineStart *
                          pxPerSec,
                      }}
                      onMouseDown={(
                        event
                      ) => {
                        event.stopPropagation();

                        seekTimeline(
                          timelineStart
                        );
                      }}
                    >

                      <div className="w-2 h-2 rounded-full bg-purple-500 -ml-[5px] mt-2 shadow-lg shadow-purple-500/30" />

                      <div className="absolute top-6 left-1 h-5 rounded bg-purple-500/10 border border-purple-500/20 px-1">

                        <span className="text-[8px] text-purple-300">
                          {index +
                            1}
                        </span>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

            {/* ===============================================
                PLAYHEAD
                =============================================== */}

            <div
              className="absolute top-0 bottom-0 z-50 pointer-events-none"
              style={{
                left:
                  playheadX,
              }}
            >

              <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-red-500 shadow-lg shadow-red-500/50" />

              <div className="absolute top-[-1px] left-1/2 -translate-x-1/2">

                <div className="w-3 h-3 bg-red-500 rotate-45 rounded-[2px] shadow-lg shadow-red-500/50" />

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          STATUS BAR
          ===================================================== */}

      <div className="h-5 shrink-0 border-t border-zinc-800/30 bg-[#0D1424] flex items-center justify-between px-3">

        <span className="text-[9px] text-zinc-600">
          {sortedClips.length}{" "}
          clip
          {sortedClips.length !==
          1
            ? "s"
            : ""}
        </span>

        <span className="text-[9px] text-zinc-600 tabular-nums">
          Timeline:{" "}
          {formatTime(
            timelineDuration
          )}
        </span>

      </div>

    </div>
  );
}