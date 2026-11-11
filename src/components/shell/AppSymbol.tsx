import * as React from "react";
import {
  ActivityIcon,
  AppWindowIcon,
  Code2Icon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  SettingsIcon,
  SparklesIcon,
  TerminalIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AppGlyph({
  iconName,
  className,
}: {
  iconName?: string;
  className?: string;
}) {
  const props = {
    className: cn("size-5 text-white drop-shadow-xs", className),
    strokeWidth: 2,
  };
  switch (iconName) {
    case "settings":
      return <SettingsIcon {...props} />;
    case "folder":
      return <FolderIcon {...props} />;
    case "terminal":
      return <TerminalIcon {...props} />;
    case "file-text":
      return <FileTextIcon {...props} />;
    case "activity":
      return <ActivityIcon {...props} />;
    case "globe":
      return <GlobeIcon {...props} />;
    case "code":
      return <Code2Icon {...props} />;
    case "sparkles":
      return <SparklesIcon {...props} />;
    default:
      return <AppWindowIcon {...props} />;
  }
}

export function AppSquircleIcon({
  iconName,
  iconUrl,
  gradient = "from-blue-500 to-indigo-600",
  className,
  glyphClassName,
}: {
  iconName?: string;
  iconUrl?: string;
  gradient?: string;
  className?: string;
  glyphClassName?: string;
}) {
  const [imgFailed, setImgFailed] = React.useState(false);

  React.useEffect(() => {
    setImgFailed(false);
  }, [iconUrl]);

  if (iconUrl && !imgFailed) {
    return (
      <img
        src={iconUrl}
        alt=""
        draggable={false}
        onError={() => setImgFailed(true)}
        className={cn(
          "pointer-events-none shrink-0 object-contain select-none drop-shadow-[0_2px_5px_rgba(0,0,0,0.28)]",
          className
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[22.5%] bg-gradient-to-b shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.35),inset_0_0_0_0.5px_rgba(0,0,0,0.15),0_2px_6px_rgba(0,0,0,0.28)]",
        gradient,
        className
      )}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
      <AppGlyph
        iconName={iconName}
        className={cn("relative z-10", glyphClassName)}
      />
    </span>
  );
}
