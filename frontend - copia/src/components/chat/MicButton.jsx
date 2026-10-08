import { useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const speechSupported = !!Recognition;

const useDictation = (onText) => {
  const rec = useRef(null);
  const [listening, setListening] = useState(false);
  const start = (current) => {
    const r = new Recognition();
    r.lang = "es-ES";
    r.continuous = true;
    r.interimResults = true;
    const base = current ? `${current.replace(/\s*$/, "")} ` : "";
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      onText(base + finalText + interim);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") toast.error("Permite el acceso al micrófono para dictar");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast.error(`Error de dictado: ${e.error}`);
    };
    r.onend = () => setListening(false);
    r.start();
    rec.current = r;
    setListening(true);
  };
  const stop = () => rec.current?.stop();
  return { listening, start, stop };
};

const UnsupportedMic = () => (
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span data-testid="mic-unsupported" tabIndex={0} title="Usa Chrome o Edge para dictar"
          className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full text-slate-300"><MicOff size={16} /></span>
      </TooltipTrigger>
      <TooltipContent>Usa Chrome o Edge para dictar</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const SupportedMic = ({ value, setValue, disabled }) => {
  const { listening, start, stop } = useDictation(setValue);
  return (
    <button type="button" data-testid="mic-button" data-listening={listening} disabled={disabled}
      onClick={() => (listening ? stop() : start(value))} aria-label={listening ? "Detener dictado" : "Dictar por voz"}
      title={listening ? "Detener dictado" : "Dictar por voz (es-ES)"}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${listening ? "bg-red-500 text-white ori-pulse" : "text-slate-500 hover:bg-slate-100 hover:text-[#1B2A3A]"}`}>
      <Mic size={16} />
    </button>
  );
};

export const MicButton = (props) => (speechSupported ? <SupportedMic {...props} /> : <UnsupportedMic />);
