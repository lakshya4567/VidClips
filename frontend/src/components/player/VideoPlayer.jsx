/**
 * VidClips - Timeline-Aware VideoPlayer
 *
 * Plays the original source video while respecting the
 * edited timeline clips from EditorContext.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Film,
} from "lucide-react";

import { useEditor } from "../../context/EditorContext";

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer() {
  const {
    videoURL,

    currentTime,
    setCurrentTime,

    duration,

    isPlaying,
    setIsPlaying,

    volume,
    playbackRate,

    videoRef,

    togglePlay,
    seek,
    stepFrame,
    changeSpeed,
    setVolumeLevel,

    clips = [],
  } = useEditor();

  const containerRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const controlsTimeout = useRef(null);

  /*
   * Prevent repeated automatic jumps.
   */
  const isJumpingRef = useRef(false);

  /*
   * ---------------------------------------------------------
   * TIMELINE DURATION
   * ---------------------------------------------------------
   *
   * This is NOT necessarily the original source duration.
   *
   * Example:
   *
   * source:
   * 0 -------- 60
   *
   * timeline:
   * 0 ---- 20    20 ---- 40
   *
   * If a section is deleted, timelineDuration becomes
   * shorter than the original video duration.
   */

  const timelineDuration = useMemo(() => {
    if (!clips || clips.length === 0) {
      return Number.isFinite(duration) ? duration : 0;
    }

    return clips.reduce((max, clip) => {
      const end = Number(clip?.end);

      if (!Number.isFinite(end)) {
        return max;
      }

      return Math.max(max, end);
    }, 0);
  }, [clips, duration]);

  /*
   * ---------------------------------------------------------
   * ACTIVE CLIP
   * ---------------------------------------------------------
   */

  const getClipAtTimelineTime = useCallback(
    (time) => {
      if (!clips.length) return null;

      return (
        clips.find((clip) => {
          const start = Number(clip.start) || 0;
          const end = Number(clip.end) || 0;

          return time >= start && time < end;
        }) || null
      );
    },
    [clips]
  );

  /*
   * ---------------------------------------------------------
   * FIND CLIP FROM SOURCE VIDEO TIME
   * ---------------------------------------------------------
   */

  const getClipAtSourceTime = useCallback(
    (sourceTime) => {
      if (!clips.length) return null;

      return (
        clips.find((clip) => {
          const sourceStart =
            Number(clip.sourceStart) || 0;

          const sourceEnd =
            Number(clip.sourceEnd) || 0;

          return (
            sourceTime >= sourceStart &&
            sourceTime < sourceEnd
          );
        }) || null
      );
    },
    [clips]
  );

  /*
   * ---------------------------------------------------------
   * SOURCE → TIMELINE
   * ---------------------------------------------------------
   *
   * Converts the real video's currentTime into the
   * edited timeline's currentTime.
   */

  const sourceToTimeline = useCallback(
    (sourceTime) => {
      const clip = getClipAtSourceTime(sourceTime);

      if (!clip) {
        return null;
      }

      const sourceStart =
        Number(clip.sourceStart) || 0;

      const timelineStart =
        Number(clip.start) || 0;

      return (
        timelineStart +
        (sourceTime - sourceStart)
      );
    },
    [getClipAtSourceTime]
  );

  /*
   * ---------------------------------------------------------
   * TIMELINE → SOURCE
   * ---------------------------------------------------------
   */

  const timelineToSource = useCallback(
    (timelineTime) => {
      const clip =
        getClipAtTimelineTime(timelineTime);

      if (!clip) {
        return null;
      }

      const timelineStart =
        Number(clip.start) || 0;

      const sourceStart =
        Number(clip.sourceStart) || 0;

      return (
        sourceStart +
        (timelineTime - timelineStart)
      );
    },
    [getClipAtTimelineTime]
  );

  /*
   * ---------------------------------------------------------
   * FIND NEXT CLIP
   * ---------------------------------------------------------
   */

  const getNextClip = useCallback(
    (timelineTime) => {
      if (!clips.length) return null;

      return (
        clips
          .filter(
            (clip) =>
              Number(clip.start) > timelineTime
          )
          .sort(
            (a, b) =>
              Number(a.start) -
              Number(b.start)
          )[0] || null
      );
    },
    [clips]
  );

  /*
   * ---------------------------------------------------------
   * FIND FIRST CLIP
   * ---------------------------------------------------------
   */

  const getFirstClip = useCallback(() => {
    if (!clips.length) return null;

    return [...clips].sort(
      (a, b) =>
        Number(a.start) -
        Number(b.start)
    )[0];
  }, [clips]);

  /*
   * ---------------------------------------------------------
   * FORMAT TIME
   * ---------------------------------------------------------
   */

  const formatTime = useCallback((time) => {
    if (
      !Number.isFinite(time) ||
      time < 0
    ) {
      return "0:00";
    }

    const hours = Math.floor(time / 3600);

    const minutes = Math.floor(
      (time % 3600) / 60
    );

    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }

    return `${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }, []);

  /*
   * ---------------------------------------------------------
   * TIMELINE-AWARE PLAYBACK
   * ---------------------------------------------------------
   */

  const playTimeline = useCallback(async () => {
    const video = videoRef.current;

    if (!video || !videoURL) {
      return;
    }

    /*
     * No edited clips:
     * play normal source video.
     */

    if (!clips.length) {
      try {
        await video.play();
      } catch {
        // Browser autoplay restriction.
      }

      return;
    }

    let timelinePosition = currentTime;

    /*
     * If timeline is at the end, restart from first clip.
     */

    if (
      timelinePosition >=
      timelineDuration - 0.01
    ) {
      const firstClip = getFirstClip();

      if (firstClip) {
        timelinePosition =
          Number(firstClip.start) || 0;

        seek(timelinePosition);
      }
    }

    /*
     * Check whether current timeline position
     * belongs to a real clip.
     */

    let clip =
      getClipAtTimelineTime(timelinePosition);

    /*
     * If the current position is inside a deleted
     * gap, jump to the next clip.
     */

    if (!clip) {
      clip = getNextClip(timelinePosition);

      if (!clip) {
        return;
      }

      timelinePosition =
        Number(clip.start) || 0;

      seek(timelinePosition);
    }

    /*
     * Make sure the source video is positioned
     * at the correct source location.
     */

    const sourcePosition =
      timelineToSource(timelinePosition);

    if (
      sourcePosition !== null &&
      Math.abs(
        video.currentTime -
          sourcePosition
      ) > 0.05
    ) {
      video.currentTime =
        sourcePosition;
    }

    try {
      await video.play();
    } catch {
      // Browser autoplay restriction.
    }
  }, [
    videoRef,
    videoURL,
    clips,
    currentTime,
    timelineDuration,
    getFirstClip,
    getClipAtTimelineTime,
    getNextClip,
    timelineToSource,
    seek,
  ]);

  /*
   * ---------------------------------------------------------
   * PAUSE / PLAY
   * ---------------------------------------------------------
   */

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;

    if (!video) return;

    if (video.paused) {
      playTimeline();
    } else {
      video.pause();
    }
  }, [videoRef, playTimeline]);

  /*
   * ---------------------------------------------------------
   * VIDEO TIME UPDATE
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   *
   * video.currentTime = SOURCE TIME
   *
   * currentTime = TIMELINE TIME
   *
   * Never assign source time directly to currentTime.
   */

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;

    if (!video || isJumpingRef.current) {
      return;
    }

    const sourceTime =
      video.currentTime;

    /*
     * No clips = normal source playback.
     */

    if (!clips.length) {
      setCurrentTime(sourceTime);
      return;
    }

    const clip =
      getClipAtSourceTime(sourceTime);

    /*
     * We have entered a deleted section.
     */

    if (!clip) {
      const nextClip = clips
        .filter(
          (item) =>
            Number(item.sourceStart) >
            sourceTime + 0.01
        )
        .sort(
          (a, b) =>
            Number(a.sourceStart) -
            Number(b.sourceStart)
        )[0];

      if (nextClip) {
        const nextTimelineTime =
          Number(nextClip.start) || 0;

        const nextSourceTime =
          Number(nextClip.sourceStart) || 0;

        isJumpingRef.current = true;

        video.currentTime =
          nextSourceTime;

        setCurrentTime(
          nextTimelineTime
        );

        requestAnimationFrame(() => {
          isJumpingRef.current = false;
        });

        return;
      }

      /*
       * Nothing remains after this point.
       */

      video.pause();

      setIsPlaying(false);

      setCurrentTime(
        timelineDuration
      );

      return;
    }

    /*
     * Convert source time to timeline time.
     */

    const timelineTime =
      sourceToTimeline(sourceTime);

    if (
      timelineTime !== null &&
      Number.isFinite(timelineTime)
    ) {
      setCurrentTime(
        Math.min(
          timelineTime,
          timelineDuration
        )
      );
    }

    /*
     * Detect the end of the current clip.
     *
     * The source video is about to enter a deleted
     * section, so jump directly to the next clip.
     */

    const sourceEnd =
      Number(clip.sourceEnd);

    if (
      Number.isFinite(sourceEnd) &&
      sourceTime >= sourceEnd - 0.03
    ) {
      const nextClip = clips
        .filter(
          (item) =>
            Number(item.start) >
            Number(clip.start)
        )
        .sort(
          (a, b) =>
            Number(a.start) -
            Number(b.start)
        )[0];

      if (nextClip) {
        const nextSource =
          Number(nextClip.sourceStart) || 0;

        const nextTimeline =
          Number(nextClip.start) || 0;

        isJumpingRef.current = true;

        video.currentTime =
          nextSource;

        setCurrentTime(
          nextTimeline
        );

        requestAnimationFrame(() => {
          isJumpingRef.current = false;
        });
      } else {
        /*
         * Last clip finished.
         */

        video.pause();

        setIsPlaying(false);

        setCurrentTime(
          timelineDuration
        );
      }
    }
  }, [
    videoRef,
    clips,
    setCurrentTime,
    setIsPlaying,
    getClipAtSourceTime,
    sourceToTimeline,
    timelineDuration,
  ]);

  /*
   * ---------------------------------------------------------
   * VIDEO ENDED
   * ---------------------------------------------------------
   */

  const handleEnded = useCallback(() => {
    const video = videoRef.current;

    if (!video) return;

    /*
     * Source video ended.
     */

    video.pause();

    setIsPlaying(false);

    setCurrentTime(
      timelineDuration
    );
  }, [
    videoRef,
    setIsPlaying,
    setCurrentTime,
    timelineDuration,
  ]);

  /*
   * ---------------------------------------------------------
   * LOADED METADATA
   * ---------------------------------------------------------
   */

  const handleLoadedMetadata =
    useCallback(() => {
      const video = videoRef.current;

      if (!video) return;

      /*
       * The Context may already handle duration.
       *
       * We deliberately don't overwrite timeline
       * duration here.
       */

      if (
        !clips.length &&
        Number.isFinite(video.duration)
      ) {
        setCurrentTime(
          Math.min(
            currentTime,
            video.duration
          )
        );
      }
    }, [
      videoRef,
      clips.length,
      currentTime,
      setCurrentTime,
    ]);

  /*
   * ---------------------------------------------------------
   * SEEK BAR
   * ---------------------------------------------------------
   */

  const handleSeek = useCallback(
    (event) => {
      if (timelineDuration <= 0) {
        return;
      }

      const rect =
        event.currentTarget.getBoundingClientRect();

      const x =
        event.clientX - rect.left;

      const percent =
        Math.max(
          0,
          Math.min(
            x / rect.width,
            1
          )
        );

      const timelineTime =
        percent * timelineDuration;

      /*
       * Context seek() is timeline-aware.
       */

      seek(timelineTime);
    },
    [timelineDuration, seek]
  );

  /*
   * ---------------------------------------------------------
   * VOLUME
   * ---------------------------------------------------------
   */

  const handleVolumeChange =
    useCallback(
      (event) => {
        setVolumeLevel(
          parseFloat(event.target.value)
        );
      },
      [setVolumeLevel]
    );

  /*
   * ---------------------------------------------------------
   * FULLSCREEN
   * ---------------------------------------------------------
   */

  const toggleFullscreen =
    useCallback(async () => {
      const element =
        containerRef.current;

      if (!element) return;

      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        } else {
          await element.requestFullscreen();
          setIsFullscreen(true);
        }
      } catch {
        // Fullscreen unavailable.
      }
    }, []);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(
        !!document.fullscreenElement
      );
    };

    document.addEventListener(
      "fullscreenchange",
      handler
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handler
      );
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * AUTO HIDE CONTROLS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!isHovering && isPlaying) {
      controlsTimeout.current =
        setTimeout(() => {
          setShowControls(false);
        }, 2500);
    } else {
      setShowControls(true);

      if (controlsTimeout.current) {
        clearTimeout(
          controlsTimeout.current
        );
      }
    }

    return () => {
      if (controlsTimeout.current) {
        clearTimeout(
          controlsTimeout.current
        );
      }
    };
  }, [isHovering, isPlaying]);

  /*
   * ---------------------------------------------------------
   * KEYBOARD CONTROLS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const handler = (event) => {
      if (
        event.target.tagName === "INPUT" ||
        event.target.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (event.code) {
        case "Space":
          event.preventDefault();
          handlePlayPause();
          break;

        case "ArrowLeft":
          event.preventDefault();
          stepFrame(-1);
          break;

        case "ArrowRight":
          event.preventDefault();
          stepFrame(1);
          break;

        case "KeyF":
          event.preventDefault();
          toggleFullscreen();
          break;

        case "KeyM":
          event.preventDefault();

          setVolumeLevel(
            volume > 0 ? 0 : 1
          );

          break;

        default:
          break;
      }
    };

    window.addEventListener(
      "keydown",
      handler
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handler
      );
    };
  }, [
    handlePlayPause,
    stepFrame,
    toggleFullscreen,
    setVolumeLevel,
    volume,
  ]);

  /*
   * ---------------------------------------------------------
   * PROGRESS
   * ---------------------------------------------------------
   */

  const progress =
    timelineDuration > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (currentTime /
              timelineDuration) *
              100
          )
        )
      : 0;

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-black flex flex-col relative group"
      onMouseEnter={() =>
        setIsHovering(true)
      }
      onMouseLeave={() =>
        setIsHovering(false)
      }
      onMouseMove={() =>
        setIsHovering(true)
      }
    >

      {/* ===================================================
          HEADER
          =================================================== */}

      <div className="h-[44px] bg-[#0F172A] border-b border-zinc-800/40 flex items-center justify-between px-4 shrink-0">

        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Film
            size={16}
            className="text-blue-400"
          />

          Preview
        </h2>

        <span className="text-[11px] text-zinc-500 tabular-nums">
          {videoURL
            ? `${formatTime(
                currentTime
              )} / ${formatTime(
                timelineDuration
              )}`
            : "No video"}
        </span>

      </div>

      {/* ===================================================
          VIDEO
          =================================================== */}

      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-[#080C14]">

        {!videoURL ? (
          <div className="flex flex-col items-center justify-center gap-4 text-zinc-600">

            <Film
              size={64}
              className="text-zinc-700"
            />

            <div className="text-center">

              <h2 className="text-xl font-semibold text-zinc-500 mb-1">
                No video loaded
              </h2>

              <p className="text-sm text-zinc-600">
                Open a video file to begin
              </p>

            </div>

          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              src={videoURL}
              className="max-h-full max-w-full"
              style={{
                objectFit: "contain",
              }}
              onTimeUpdate={
                handleTimeUpdate
              }
              onLoadedMetadata={
                handleLoadedMetadata
              }
              onPlay={() =>
                setIsPlaying(true)
              }
              onPause={() =>
                setIsPlaying(false)
              }
              onEnded={handleEnded}
              onClick={
                handlePlayPause
              }
              playsInline
              preload="auto"
            />

            {/* Center play button */}

            {!isPlaying && (
              <button
                onClick={
                  handlePlayPause
                }
                className="absolute inset-0 flex items-center justify-center bg-black/20"
              >
                <div className="w-16 h-16 rounded-full bg-blue-600/90 hover:bg-blue-500 flex items-center justify-center transition-all shadow-2xl shadow-blue-600/30">

                  <Play
                    size={28}
                    className="text-white ml-1"
                  />

                </div>
              </button>
            )}
          </>
        )}

      </div>

      {/* ===================================================
          CONTROLS
          =================================================== */}

      <div
        className={`
          bg-[#0F172A]
          border-t border-zinc-800/40
          transition-opacity duration-300
          ${
            showControls || !isPlaying
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }
        `}
      >

        {/* =================================================
            TIMELINE SEEK BAR
            ================================================= */}

        <div
          className="h-2 bg-zinc-800/60 cursor-pointer relative"
          onClick={handleSeek}
        >

          <div className="h-full bg-zinc-800 rounded-full mx-2 relative overflow-hidden">

            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
              style={{
                width: `${progress}%`,
              }}
            />

            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 hover:opacity-100"
              style={{
                left: `calc(${progress}% - 6px)`,
              }}
            />

          </div>

        </div>

        {/* =================================================
            CONTROL ROW
            ================================================= */}

        <div className="h-12 flex items-center justify-between px-4">

          {/* LEFT */}

          <div className="flex items-center gap-1.5">

            {/* Previous frame */}

            <button
              onClick={() =>
                stepFrame(-1)
              }
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Previous frame"
            >
              <ChevronLeft
                size={16}
              />
            </button>

            {/* Play */}

            <button
              onClick={
                handlePlayPause
              }
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors"
              title={
                isPlaying
                  ? "Pause (Space)"
                  : "Play (Space)"
              }
            >
              {isPlaying ? (
                <Pause size={18} />
              ) : (
                <Play size={18} />
              )}
            </button>

            {/* Next frame */}

            <button
              onClick={() =>
                stepFrame(1)
              }
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Next frame"
            >
              <ChevronRight
                size={16}
              />
            </button>

            <div className="w-px h-5 bg-zinc-800 mx-2" />

            {/* Volume */}

            <button
              onClick={() =>
                setVolumeLevel(
                  volume > 0 ? 0 : 1
                )
              }
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Mute (M)"
            >
              {volume > 0 ? (
                <Volume2 size={16} />
              ) : (
                <VolumeX size={16} />
              )}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={
                handleVolumeChange
              }
              className="w-20 h-1 accent-blue-500 cursor-pointer"
              title="Volume"
            />

            <span className="text-[11px] text-zinc-500 ml-2 tabular-nums">
              {formatTime(
                currentTime
              )}
              {" / "}
              {formatTime(
                timelineDuration
              )}
            </span>

          </div>

          {/* RIGHT */}

          <div className="flex items-center gap-1.5">

            {/* Speed */}

            <div className="relative">

              <button
                onClick={() =>
                  setShowSpeedMenu(
                    (value) => !value
                  )
                }
                className="px-2 py-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors text-xs font-mono"
              >
                {playbackRate}x
              </button>

              {showSpeedMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() =>
                      setShowSpeedMenu(
                        false
                      )
                    }
                  />

                  <div className="absolute bottom-full right-0 mb-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-20 py-1 min-w-[80px]">

                    {SPEEDS.map(
                      (speed) => (
                        <button
                          key={speed}
                          onClick={() => {
                            changeSpeed(
                              speed
                            );

                            setShowSpeedMenu(
                              false
                            );
                          }}
                          className={`w-full px-3 py-1.5 text-xs text-left hover:bg-zinc-800 transition-colors ${
                            playbackRate ===
                            speed
                              ? "text-blue-400"
                              : "text-zinc-400"
                          }`}
                        >
                          {speed}x
                        </button>
                      )
                    )}

                  </div>
                </>
              )}

            </div>

            <div className="w-px h-5 bg-zinc-800 mx-1" />

            {/* Fullscreen */}

            <button
              onClick={
                toggleFullscreen
              }
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Fullscreen (F)"
            >
              {isFullscreen ? (
                <Minimize2
                  size={16}
                />
              ) : (
                <Maximize2
                  size={16}
                />
              )}
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}