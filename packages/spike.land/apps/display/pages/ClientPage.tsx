"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getTwilioIceServers } from "@apps/display/lib/webrtc/config";
import {
  AlertCircle,
  Camera,
  Menu,
  Mic,
  MicOff,
  MonitorUp,
  SwitchCamera,
  Video,
  VideoOff,
  X,
  ZoomIn,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { MediaConnection } from "peerjs";
import Peer from "peerjs";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

type CameraFacingMode = "user" | "environment";

interface MediaTrackCapabilities {
  zoom?: {
    min: number;
    max: number;
    step: number;
  };
}

interface ErrorState {
  message: string;
  type: "permission" | "camera" | "connection" | "general";
}

interface CameraStream {
  stream: MediaStream;
  call: MediaConnection | null;
  facingMode: CameraFacingMode;
  isConnected: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  zoom: number;
  zoomSupported: boolean;
  zoomRange: { min: number; max: number };
}

function ClientPageContent() {
  const searchParams = useSearchParams();
  const frontVideoRef = useRef<HTMLVideoElement>(null);
  const backVideoRef = useRef<HTMLVideoElement>(null);
  const frontPeerRef = useRef<Peer | null>(null);
  const backPeerRef = useRef<Peer | null>(null);

  const [displayId, setDisplayId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDualCameraMode, setIsDualCameraMode] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Camera streams state
  const [frontCamera, setFrontCamera] = useState<CameraStream>({
    stream: null as unknown as MediaStream,
    call: null,
    facingMode: "user",
    isConnected: false,
    isMuted: false,
    isVideoEnabled: true,
    zoom: 1,
    zoomSupported: false,
    zoomRange: { min: 1, max: 4 },
  });

  const [backCamera, setBackCamera] = useState<CameraStream>({
    stream: null as unknown as MediaStream,
    call: null,
    facingMode: "environment",
    isConnected: false,
    isMuted: false,
    isVideoEnabled: true,
    zoom: 1,
    zoomSupported: false,
    zoomRange: { min: 1, max: 4 },
  });

  // Get displayId from URL
  useEffect(() => {
    const id = searchParams.get("displayId");
    if (id) {
      setDisplayId(id);
    } else {
      setError({
        message: "No display ID provided. Please scan a QR code from a display.",
        type: "general",
      });
      setIsLoading(false);
    }
  }, [searchParams]);

  // Load dual camera preference
  useEffect(() => {
    const savedMode = localStorage.getItem("dualCameraMode");
    if (savedMode === "true") {
      setIsDualCameraMode(true);
    }
  }, []);

  // Start a specific camera
  const startCamera = useCallback(async (facingMode: CameraFacingMode) => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Check zoom support
      const videoTrack = stream.getVideoTracks()[0];
      let zoomSupported = false;
      let zoomRange = { min: 1, max: 4 };
      let zoom = 1;

      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities() as MediaTrackCapabilities;
        if (capabilities.zoom) {
          zoomSupported = true;
          zoomRange = {
            min: capabilities.zoom.min,
            max: capabilities.zoom.max,
          };
          zoom = capabilities.zoom.min;
        }
      }

      return { stream, zoomSupported, zoomRange, zoom };
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError({
            message: "Camera permission denied. Please allow camera access and reload.",
            type: "permission",
          });
        } else if (err.name === "NotFoundError") {
          setError({
            message: "No camera found on this device.",
            type: "camera",
          });
        } else {
          setError({
            message: `Camera error: ${err.message}`,
            type: "camera",
          });
        }
      }
      throw err;
    }
  }, []);

  // Create PeerJS call for a camera
  const createCameraCall = useCallback(
    (stream: MediaStream, cameraType: "front" | "back") => {
      const peerRef = cameraType === "front" ? frontPeerRef : backPeerRef;

      if (!peerRef.current || !displayId) return null;

      const call = peerRef.current.call(displayId, stream);

      call.on("close", () => {
        if (cameraType === "front") {
          setFrontCamera((prev) => ({ ...prev, isConnected: false }));
        } else {
          setBackCamera((prev) => ({ ...prev, isConnected: false }));
        }
      });

      call.on("error", () => {
        setError({
          message: `${cameraType === "front" ? "Front" : "Back"} camera connection failed.`,
          type: "connection",
        });
        if (cameraType === "front") {
          setFrontCamera((prev) => ({ ...prev, isConnected: false }));
        } else {
          setBackCamera((prev) => ({ ...prev, isConnected: false }));
        }
      });

      // Set connected immediately - display doesn't send stream back
      if (cameraType === "front") {
        setFrontCamera((prev) => ({ ...prev, isConnected: true }));
      } else {
        setBackCamera((prev) => ({ ...prev, isConnected: true }));
      }

      return call;
    },
    [displayId],
  );

  useEffect(() => {
    if (!displayId) return;

    let mounted = true;

    const init = async () => {
      try {
        // Fetch Twilio ICE servers
        const iceServers = await getTwilioIceServers();

        let peersInitialized = 0;
        const peersNeeded = isDualCameraMode ? 2 : 1;

        // Initialize PeerJS instances
        if (isDualCameraMode) {
          // Create two separate Peer instances with unique IDs
          const frontPeer = new Peer({
            config: { iceServers },
          });

          const backPeer = new Peer({
            config: { iceServers },
          });

          frontPeerRef.current = frontPeer;
          backPeerRef.current = backPeer;

          // Wait for both peers to be ready
          frontPeer.on("open", async (id) => {
            console.log("Front peer opened with ID:", id);
            peersInitialized++;
            if (peersInitialized === peersNeeded && mounted) {
              await initializeCameras();
            }
          });

          backPeer.on("open", async (id) => {
            console.log("Back peer opened with ID:", id);
            peersInitialized++;
            if (peersInitialized === peersNeeded && mounted) {
              await initializeCameras();
            }
          });

          frontPeer.on("error", () => {
            setError({
              message: "Failed to establish front camera peer connection.",
              type: "connection",
            });
          });

          backPeer.on("error", () => {
            setError({
              message: "Failed to establish back camera peer connection.",
              type: "connection",
            });
          });
        } else {
          // Single camera mode - create one peer
          const peer = new Peer({
            config: { iceServers },
          });

          // Determine which peer ref to use based on camera preference
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent,
          );
          const defaultMode = isMobile ? "environment" : "user";
          const savedMode = localStorage.getItem("preferredCamera");
          const facingMode =
            savedMode === "user" || savedMode === "environment" ? savedMode : defaultMode;

          if (facingMode === "user") {
            frontPeerRef.current = peer;
          } else {
            backPeerRef.current = peer;
          }

          peer.on("open", async () => {
            if (!mounted) return;
            await initializeCameras();
          });

          peer.on("error", () => {
            setError({
              message: "Failed to establish peer connection. Please check your internet.",
              type: "connection",
            });
          });
        }

        async function initializeCameras() {
          if (!mounted) return;

          try {
            if (isDualCameraMode) {
              // Start both cameras
              const [frontResult, backResult] = await Promise.all([
                startCamera("user"),
                startCamera("environment"),
              ]);

              if (!mounted) return;

              // Setup front camera
              setFrontCamera((prev) => ({
                ...prev,
                stream: frontResult.stream,
                zoom: frontResult.zoom,
                zoomSupported: frontResult.zoomSupported,
                zoomRange: frontResult.zoomRange,
              }));

              if (frontVideoRef.current) {
                frontVideoRef.current.srcObject = frontResult.stream;
              }

              const frontCall = createCameraCall(frontResult.stream, "front");
              setFrontCamera((prev) => ({ ...prev, call: frontCall }));

              // Setup back camera
              setBackCamera((prev) => ({
                ...prev,
                stream: backResult.stream,
                zoom: backResult.zoom,
                zoomSupported: backResult.zoomSupported,
                zoomRange: backResult.zoomRange,
              }));

              if (backVideoRef.current) {
                backVideoRef.current.srcObject = backResult.stream;
              }

              const backCall = createCameraCall(backResult.stream, "back");
              setBackCamera((prev) => ({ ...prev, call: backCall }));
            } else {
              // Start single camera (detect device type)
              const isMobile =
                /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                  navigator.userAgent,
                );
              const defaultMode = isMobile ? "environment" : "user";
              const savedMode = localStorage.getItem("preferredCamera");
              const facingMode =
                savedMode === "user" || savedMode === "environment" ? savedMode : defaultMode;

              const result = await startCamera(facingMode as CameraFacingMode);

              if (!mounted) return;

              if (facingMode === "user") {
                setFrontCamera((prev) => ({
                  ...prev,
                  stream: result.stream,
                  zoom: result.zoom,
                  zoomSupported: result.zoomSupported,
                  zoomRange: result.zoomRange,
                }));

                if (frontVideoRef.current) {
                  frontVideoRef.current.srcObject = result.stream;
                }

                const call = createCameraCall(result.stream, "front");
                setFrontCamera((prev) => ({ ...prev, call }));
              } else {
                setBackCamera((prev) => ({
                  ...prev,
                  stream: result.stream,
                  zoom: result.zoom,
                  zoomSupported: result.zoomSupported,
                  zoomRange: result.zoomRange,
                }));

                if (backVideoRef.current) {
                  backVideoRef.current.srcObject = result.stream;
                }

                const call = createCameraCall(result.stream, "back");
                setBackCamera((prev) => ({ ...prev, call }));
              }
            }

            setIsLoading(false);
          } catch {
            setIsLoading(false);
          }
        }
      } catch {
        setIsLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;

      // Cleanup - access current state via refs, not dependencies
      if (frontPeerRef.current) {
        frontPeerRef.current.destroy();
      }
      if (backPeerRef.current) {
        backPeerRef.current.destroy();
      }
    };
  }, [displayId, isDualCameraMode, startCamera, createCameraCall]);

  // Toggle dual camera mode
  const handleToggleDualCamera = useCallback(async () => {
    const newMode = !isDualCameraMode;
    setIsDualCameraMode(newMode);
    localStorage.setItem("dualCameraMode", String(newMode));

    // Cleanup existing streams
    if (frontCamera.stream) {
      frontCamera.stream.getTracks().forEach((track) => track.stop());
    }
    if (backCamera.stream) {
      backCamera.stream.getTracks().forEach((track) => track.stop());
    }
    if (frontCamera.call) {
      frontCamera.call.close();
    }
    if (backCamera.call) {
      backCamera.call.close();
    }

    setIsLoading(true);

    try {
      if (newMode) {
        // Enable both cameras
        const [frontResult, backResult] = await Promise.all([
          startCamera("user"),
          startCamera("environment"),
        ]);

        // Setup front camera
        setFrontCamera({
          stream: frontResult.stream,
          call: null,
          facingMode: "user",
          isConnected: false,
          isMuted: false,
          isVideoEnabled: true,
          zoom: frontResult.zoom,
          zoomSupported: frontResult.zoomSupported,
          zoomRange: frontResult.zoomRange,
        });

        if (frontVideoRef.current) {
          frontVideoRef.current.srcObject = frontResult.stream;
        }

        const frontCall = createCameraCall(frontResult.stream, "front");
        setFrontCamera((prev) => ({ ...prev, call: frontCall }));

        // Setup back camera
        setBackCamera({
          stream: backResult.stream,
          call: null,
          facingMode: "environment",
          isConnected: false,
          isMuted: false,
          isVideoEnabled: true,
          zoom: backResult.zoom,
          zoomSupported: backResult.zoomSupported,
          zoomRange: backResult.zoomRange,
        });

        if (backVideoRef.current) {
          backVideoRef.current.srcObject = backResult.stream;
        }

        const backCall = createCameraCall(backResult.stream, "back");
        setBackCamera((prev) => ({ ...prev, call: backCall }));
      } else {
        // Disable dual mode - keep only one camera (back camera by default)
        if (backCamera.stream) {
          backCamera.stream.getTracks().forEach((track) => track.stop());
        }

        const savedMode = localStorage.getItem("preferredCamera") || "user";
        const facingMode = savedMode === "user" || savedMode === "environment" ? savedMode : "user";

        const result = await startCamera(facingMode as CameraFacingMode);

        if (facingMode === "user") {
          setFrontCamera({
            stream: result.stream,
            call: null,
            facingMode: "user",
            isConnected: false,
            isMuted: false,
            isVideoEnabled: true,
            zoom: result.zoom,
            zoomSupported: result.zoomSupported,
            zoomRange: result.zoomRange,
          });

          if (frontVideoRef.current) {
            frontVideoRef.current.srcObject = result.stream;
          }

          const call = createCameraCall(result.stream, "front");
          setFrontCamera((prev) => ({ ...prev, call }));

          // Clear back camera
          setBackCamera({
            stream: null as unknown as MediaStream,
            call: null,
            facingMode: "environment",
            isConnected: false,
            isMuted: false,
            isVideoEnabled: true,
            zoom: 1,
            zoomSupported: false,
            zoomRange: { min: 1, max: 4 },
          });
        } else {
          setBackCamera({
            stream: result.stream,
            call: null,
            facingMode: "environment",
            isConnected: false,
            isMuted: false,
            isVideoEnabled: true,
            zoom: result.zoom,
            zoomSupported: result.zoomSupported,
            zoomRange: result.zoomRange,
          });

          if (backVideoRef.current) {
            backVideoRef.current.srcObject = result.stream;
          }

          const call = createCameraCall(result.stream, "back");
          setBackCamera((prev) => ({ ...prev, call }));

          // Clear front camera
          setFrontCamera({
            stream: null as unknown as MediaStream,
            call: null,
            facingMode: "user",
            isConnected: false,
            isMuted: false,
            isVideoEnabled: true,
            zoom: 1,
            zoomSupported: false,
            zoomRange: { min: 1, max: 4 },
          });
        }
      }

      setIsLoading(false);
    } catch {
      setIsLoading(false);
    }
  }, [isDualCameraMode, frontCamera, backCamera, startCamera, createCameraCall]);

  // Toggle mute for specific camera
  const handleToggleMute = useCallback(
    (cameraType: "front" | "back") => {
      const camera = cameraType === "front" ? frontCamera : backCamera;
      const setCamera = cameraType === "front" ? setFrontCamera : setBackCamera;

      if (camera.stream) {
        const audioTracks = camera.stream.getAudioTracks();
        audioTracks.forEach((track) => {
          track.enabled = !track.enabled;
        });
        setCamera((prev) => ({ ...prev, isMuted: !prev.isMuted }));
      }
    },
    [frontCamera, backCamera],
  );

  // Toggle video for specific camera
  const handleToggleVideo = useCallback(
    (cameraType: "front" | "back") => {
      const camera = cameraType === "front" ? frontCamera : backCamera;
      const setCamera = cameraType === "front" ? setFrontCamera : setBackCamera;

      if (camera.stream) {
        const videoTracks = camera.stream.getVideoTracks();
        videoTracks.forEach((track) => {
          track.enabled = !track.enabled;
        });
        setCamera((prev) => ({ ...prev, isVideoEnabled: !prev.isVideoEnabled }));
      }
    },
    [frontCamera, backCamera],
  );

  // Handle zoom for specific camera
  const handleZoomChange = useCallback(
    async (cameraType: "front" | "back", value: number[]) => {
      const camera = cameraType === "front" ? frontCamera : backCamera;
      const setCamera = cameraType === "front" ? setFrontCamera : setBackCamera;

      const newZoom = value[0];
      if (newZoom === undefined) return;

      setCamera((prev) => ({ ...prev, zoom: newZoom }));

      if (camera.stream) {
        const videoTrack = camera.stream.getVideoTracks()[0];
        if (videoTrack) {
          try {
            await videoTrack.applyConstraints({
              // @ts-expect-error - zoom is not in standard MediaTrackConstraints types yet
              advanced: [{ zoom: newZoom }],
            });
          } catch {
            // Zoom constraint failed
          }
        }
      }
    },
    [frontCamera, backCamera],
  );

  // Switch camera (only in single camera mode)
  const handleSwitchCamera = useCallback(async () => {
    if (isDualCameraMode) return;

    const currentCamera = frontCamera.stream ? "front" : "back";
    const newMode = currentCamera === "front" ? "environment" : "user";
    localStorage.setItem("preferredCamera", newMode);

    try {
      // Stop current camera
      if (frontCamera.stream) {
        frontCamera.stream.getTracks().forEach((track) => track.stop());
        if (frontCamera.call) {
          frontCamera.call.close();
        }
      }
      if (backCamera.stream) {
        backCamera.stream.getTracks().forEach((track) => track.stop());
        if (backCamera.call) {
          backCamera.call.close();
        }
      }

      const result = await startCamera(newMode);

      if (newMode === "user") {
        setFrontCamera({
          stream: result.stream,
          call: null,
          facingMode: "user",
          isConnected: false,
          isMuted: false,
          isVideoEnabled: true,
          zoom: result.zoom,
          zoomSupported: result.zoomSupported,
          zoomRange: result.zoomRange,
        });

        if (frontVideoRef.current) {
          frontVideoRef.current.srcObject = result.stream;
        }

        const call = createCameraCall(result.stream, "front");
        setFrontCamera((prev) => ({ ...prev, call }));

        setBackCamera({
          stream: null as unknown as MediaStream,
          call: null,
          facingMode: "environment",
          isConnected: false,
          isMuted: false,
          isVideoEnabled: true,
          zoom: 1,
          zoomSupported: false,
          zoomRange: { min: 1, max: 4 },
        });
      } else {
        setBackCamera({
          stream: result.stream,
          call: null,
          facingMode: "environment",
          isConnected: false,
          isMuted: false,
          isVideoEnabled: true,
          zoom: result.zoom,
          zoomSupported: result.zoomSupported,
          zoomRange: result.zoomRange,
        });

        if (backVideoRef.current) {
          backVideoRef.current.srcObject = result.stream;
        }

        const call = createCameraCall(result.stream, "back");
        setBackCamera((prev) => ({ ...prev, call }));

        setFrontCamera({
          stream: null as unknown as MediaStream,
          call: null,
          facingMode: "user",
          isConnected: false,
          isMuted: false,
          isVideoEnabled: true,
          zoom: 1,
          zoomSupported: false,
          zoomRange: { min: 1, max: 4 },
        });
      }
    } catch {
      // Switch camera failed
    }
  }, [isDualCameraMode, frontCamera, backCamera, startCamera, createCameraCall]);

  // Share screen
  const handleShareScreen = useCallback(async () => {
    try {
      if (isSharingScreen) {
        // Stop screen sharing - not implemented in dual camera mode
        setIsSharingScreen(false);
      } else {
        // Start screen sharing - not implemented in dual camera mode
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        // Stop cameras
        if (frontCamera.stream) {
          frontCamera.stream.getTracks().forEach((track) => track.stop());
          if (frontCamera.call) {
            frontCamera.call.close();
          }
        }
        if (backCamera.stream) {
          backCamera.stream.getTracks().forEach((track) => track.stop());
          if (backCamera.call) {
            backCamera.call.close();
          }
        }

        if (frontVideoRef.current) {
          frontVideoRef.current.srcObject = displayStream;
        }

        setIsSharingScreen(true);

        const call = createCameraCall(displayStream, "front");
        setFrontCamera((prev) => ({ ...prev, stream: displayStream, call }));

        // Listen for user stopping screen share
        const videoTrack = displayStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            handleShareScreen();
          };
        }
      }
    } catch {
      setError({
        message: "Failed to share screen. Please try again.",
        type: "general",
      });
    }
  }, [isSharingScreen, frontCamera, backCamera, createCameraCall]);

  if (error && !frontCamera.stream && !backCamera.stream) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-black">
        <div className="bg-red-950 border border-red-800 rounded-lg p-6 max-w-md w-full">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-red-100 mb-2">Error</h2>
              <p className="text-red-200 text-sm">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-white text-center">
          <Video className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <p className="text-lg">Starting camera...</p>
        </div>
      </div>
    );
  }

  const isConnected = frontCamera.isConnected || backCamera.isConnected;
  const activeCamera = frontCamera.stream ? frontCamera : backCamera;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Video preview */}
      {isDualCameraMode ? (
        /* Dual camera mode - split screen */
        <div className="absolute inset-0 grid grid-cols-2 gap-2 p-2">
          <div className="relative">
            <video
              ref={frontVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover rounded-lg"
            />
            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
              Front Camera
            </div>
            {!frontCamera.isVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
                <VideoOff className="w-12 h-12 text-white/50" />
              </div>
            )}
          </div>
          <div className="relative">
            <video
              ref={backVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover rounded-lg"
            />
            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
              Back Camera
            </div>
            {!backCamera.isVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
                <VideoOff className="w-12 h-12 text-white/50" />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Single camera mode - full screen */
        <>
          <video
            ref={frontCamera.stream ? frontVideoRef : backVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {!activeCamera.isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-center">
                <VideoOff className="w-16 h-16 text-white/50 mx-auto mb-4" />
                <p className="text-white/70 text-lg">Video is disabled</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Connection status */}
      <div className="absolute top-4 left-4 z-20 space-y-2">
        <div
          className={`px-3 py-1.5 rounded-full text-sm font-medium ${
            isConnected
              ? "bg-green-500/20 text-green-400 border border-green-500/50"
              : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
          }`}
        >
          {isConnected ? "Connected" : "Connecting..."}
        </div>
        {isDualCameraMode && (
          <div className="space-y-1">
            {frontCamera.stream && (
              <div
                className={`px-2 py-1 rounded text-xs ${
                  frontCamera.isConnected
                    ? "bg-green-500/20 text-green-400"
                    : "bg-gray-500/20 text-gray-400"
                }`}
              >
                Front: {frontCamera.isConnected ? "✓" : "○"}
              </div>
            )}
            {backCamera.stream && (
              <div
                className={`px-2 py-1 rounded text-xs ${
                  backCamera.isConnected
                    ? "bg-green-500/20 text-green-400"
                    : "bg-gray-500/20 text-gray-400"
                }`}
              >
                Back: {backCamera.isConnected ? "✓" : "○"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (frontCamera.stream || backCamera.stream) && (
        <div className="absolute top-4 right-4 left-4 z-20 md:left-auto md:w-96">
          <div className="bg-red-950/90 backdrop-blur border border-red-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-200 text-sm flex-1">{error.message}</p>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hamburger menu button */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="absolute top-4 right-4 z-30 p-3 rounded-full bg-black/50 backdrop-blur text-white hover:bg-black/70 transition-colors"
        aria-label="Toggle menu"
      >
        {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Controls panel */}
      <div
        className={`absolute right-0 top-0 h-full w-80 bg-black/90 backdrop-blur-lg border-l border-white/10 p-6 z-20 transition-transform duration-300 overflow-y-auto ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <h2 className="text-white text-xl font-semibold mb-6">Camera Controls</h2>

          <div className="space-y-6 flex-1">
            {/* Dual Camera Mode Toggle */}
            <Button
              onClick={handleToggleDualCamera}
              variant={isDualCameraMode ? "default" : "outline"}
              className={`w-full justify-start gap-3 ${
                !isDualCameraMode ? "bg-white/10 text-white hover:bg-white/20 border-white/30" : ""
              }`}
              disabled={isSharingScreen}
            >
              <Camera className="w-5 h-5" />
              {isDualCameraMode ? "Dual Camera Mode: ON" : "Dual Camera Mode: OFF"}
            </Button>

            {isDualCameraMode ? (
              /* Dual camera controls */
              <>
                {/* Front Camera Controls */}
                {frontCamera.stream && (
                  <div className="space-y-4 border-t border-white/10 pt-4">
                    <h3 className="text-white text-sm font-semibold">Front Camera</h3>

                    {frontCamera.zoomSupported && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <ZoomIn className="w-5 h-5 text-white" />
                          <label className="text-white text-sm font-medium">
                            Zoom: {frontCamera.zoom.toFixed(1)}x
                          </label>
                        </div>
                        <Slider
                          value={[frontCamera.zoom]}
                          onValueChange={(value) => handleZoomChange("front", value)}
                          min={frontCamera.zoomRange.min}
                          max={frontCamera.zoomRange.max}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                    )}

                    <Button
                      onClick={() => handleToggleVideo("front")}
                      variant="outline"
                      className="w-full justify-start gap-3 bg-white/10 text-white hover:bg-white/20 border-white/30"
                    >
                      {frontCamera.isVideoEnabled ? (
                        <>
                          <Video className="w-5 h-5" />
                          Disable Video
                        </>
                      ) : (
                        <>
                          <VideoOff className="w-5 h-5" />
                          Enable Video
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleToggleMute("front")}
                      variant="outline"
                      className="w-full justify-start gap-3 bg-white/10 text-white hover:bg-white/20 border-white/30"
                    >
                      {frontCamera.isMuted ? (
                        <>
                          <MicOff className="w-5 h-5" />
                          Unmute
                        </>
                      ) : (
                        <>
                          <Mic className="w-5 h-5" />
                          Mute
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Back Camera Controls */}
                {backCamera.stream && (
                  <div className="space-y-4 border-t border-white/10 pt-4">
                    <h3 className="text-white text-sm font-semibold">Back Camera</h3>

                    {backCamera.zoomSupported && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <ZoomIn className="w-5 h-5 text-white" />
                          <label className="text-white text-sm font-medium">
                            Zoom: {backCamera.zoom.toFixed(1)}x
                          </label>
                        </div>
                        <Slider
                          value={[backCamera.zoom]}
                          onValueChange={(value) => handleZoomChange("back", value)}
                          min={backCamera.zoomRange.min}
                          max={backCamera.zoomRange.max}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                    )}

                    <Button
                      onClick={() => handleToggleVideo("back")}
                      variant="outline"
                      className="w-full justify-start gap-3 bg-white/10 text-white hover:bg-white/20 border-white/30"
                    >
                      {backCamera.isVideoEnabled ? (
                        <>
                          <Video className="w-5 h-5" />
                          Disable Video
                        </>
                      ) : (
                        <>
                          <VideoOff className="w-5 h-5" />
                          Enable Video
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleToggleMute("back")}
                      variant="outline"
                      className="w-full justify-start gap-3 bg-white/10 text-white hover:bg-white/20 border-white/30"
                    >
                      {backCamera.isMuted ? (
                        <>
                          <MicOff className="w-5 h-5" />
                          Unmute
                        </>
                      ) : (
                        <>
                          <Mic className="w-5 h-5" />
                          Mute
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              /* Single camera controls */
              <>
                {activeCamera.zoomSupported && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ZoomIn className="w-5 h-5 text-white" />
                      <label className="text-white text-sm font-medium">
                        Zoom: {activeCamera.zoom.toFixed(1)}x
                      </label>
                    </div>
                    <Slider
                      value={[activeCamera.zoom]}
                      onValueChange={(value) =>
                        handleZoomChange(frontCamera.stream ? "front" : "back", value)
                      }
                      min={activeCamera.zoomRange.min}
                      max={activeCamera.zoomRange.max}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                )}

                <Button
                  onClick={handleSwitchCamera}
                  variant="outline"
                  className="w-full justify-start gap-3 bg-white/10 text-white hover:bg-white/20 border-white/30"
                  disabled={isSharingScreen}
                >
                  <SwitchCamera className="w-5 h-5" />
                  Switch Camera ({frontCamera.stream ? "Front" : "Back"})
                </Button>

                <Button
                  onClick={() => handleToggleVideo(frontCamera.stream ? "front" : "back")}
                  variant="outline"
                  className="w-full justify-start gap-3 bg-white/10 text-white hover:bg-white/20 border-white/30"
                >
                  {activeCamera.isVideoEnabled ? (
                    <>
                      <Video className="w-5 h-5" />
                      Disable Video
                    </>
                  ) : (
                    <>
                      <VideoOff className="w-5 h-5" />
                      Enable Video
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleToggleMute(frontCamera.stream ? "front" : "back")}
                  variant="outline"
                  className="w-full justify-start gap-3 bg-white/10 text-white hover:bg-white/20 border-white/30"
                >
                  {activeCamera.isMuted ? (
                    <>
                      <MicOff className="w-5 h-5" />
                      Unmute
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      Mute
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleShareScreen}
                  variant={isSharingScreen ? "default" : "outline"}
                  className={`w-full justify-start gap-3 ${
                    !isSharingScreen
                      ? "bg-white/10 text-white hover:bg-white/20 border-white/30"
                      : ""
                  }`}
                >
                  <MonitorUp className="w-5 h-5" />
                  {isSharingScreen ? "Stop Sharing" : "Share Screen"}
                </Button>
              </>
            )}
          </div>

          {/* Close button */}
          <Button onClick={() => setMenuOpen(false)} variant="secondary" className="w-full mt-6">
            Close Menu
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ClientPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="text-white text-center">
            <Video className="w-12 h-12 mx-auto mb-4 animate-pulse" />
            <p className="text-lg">Loading...</p>
          </div>
        </div>
      }
    >
      <ClientPageContent />
    </Suspense>
  );
}
