"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mic, Square } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type RecordingState = "idle" | "recording" | "processing";

interface RecordButtonProps {
  onRecordingComplete?: (blob: Blob) => void;
  onTranscription?: (text: string) => void;
  className?: string;
  disabled?: boolean;
  maxDuration?: number; // in seconds
}

export function RecordButton({
  onRecordingComplete,
  onTranscription: _onTranscription,
  className,
  disabled = false,
  maxDuration = 60,
}: RecordButtonProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType,
        });

        setState("processing");
        onRecordingComplete?.(blob);

        // Simulate transcription processing
        // In real implementation, this would call a speech-to-text API
        setTimeout(() => {
          setState("idle");
          setDuration(0);
        }, 1000);
      };

      mediaRecorder.start(100);
      setState("recording");

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      setState("idle");
    }
  }, [maxDuration, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();

      // Stop all tracks
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [state]);

  const handleClick = useCallback(() => {
    if (state === "idle") {
      startRecording();
    } else if (state === "recording") {
      stopRecording();
    }
  }, [state, startRecording, stopRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("relative inline-flex items-center gap-2", className)}>
      <AnimatePresence mode="wait">
        {state === "recording" && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="text-sm font-mono text-destructive tabular-nums"
          >
            {formatDuration(duration)}
          </motion.span>
        )}
      </AnimatePresence>

      <Button
        type="button"
        size="icon"
        variant={state === "recording" ? "destructive" : "ghost"}
        onClick={handleClick}
        disabled={disabled || state === "processing"}
        className={cn(
          "relative size-9 rounded-full transition-all",
          state === "recording" && "animate-pulse"
        )}
      >
        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div
              key="mic"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Mic className="size-4" />
            </motion.div>
          )}
          {state === "recording" && (
            <motion.div
              key="stop"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Square className="size-3 fill-current" />
            </motion.div>
          )}
          {state === "processing" && (
            <motion.div
              key="processing"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Loader2 className="size-4 animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recording indicator ring */}
        {state === "recording" && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-destructive"
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        )}
      </Button>
    </div>
  );
}

// Hook for using audio recording in other components
export function useAudioRecording(options?: {
  onRecordingComplete?: (blob: Blob) => void;
  maxDuration?: number;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setIsProcessing(true);
        options?.onRecordingComplete?.(blob);
        setTimeout(() => {
          setIsProcessing(false);
          setDuration(0);
        }, 500);
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (options?.maxDuration && prev >= options.maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, [options]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  return {
    isRecording,
    isProcessing,
    duration,
    startRecording,
    stopRecording,
  };
}
