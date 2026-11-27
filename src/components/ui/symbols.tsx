/**
 * Lucide's names, drawn with the icon theme's symbolic icon where it has one
 * (see `<SymbolicIcon>`). Import from here instead of `lucide-react`.
 */
import * as React from "react";
import {
  AlertCircleIcon as LucideAlertCircleIcon,
  AlertTriangleIcon as LucideAlertTriangleIcon,
  AppWindowIcon as LucideAppWindowIcon,
  ArrowLeftIcon as LucideArrowLeftIcon,
  ArrowRightIcon as LucideArrowRightIcon,
  ArrowUpCircleIcon as LucideArrowUpCircleIcon,
  ArrowUpIcon as LucideArrowUpIcon,
  BatteryChargingIcon as LucideBatteryChargingIcon,
  BatteryIcon as LucideBatteryIcon,
  BellIcon as LucideBellIcon,
  BellRingIcon as LucideBellRingIcon,
  BlocksIcon as LucideBlocksIcon,
  CalculatorIcon as LucideCalculatorIcon,
  CameraIcon as LucideCameraIcon,
  CheckIcon as LucideCheckIcon,
  ChevronDownIcon as LucideChevronDownIcon,
  ChevronLeftIcon as LucideChevronLeftIcon,
  ChevronRightIcon as LucideChevronRightIcon,
  ChevronUpIcon as LucideChevronUpIcon,
  ClockIcon as LucideClockIcon,
  Columns2Icon as LucideColumns2Icon,
  DownloadIcon as LucideDownloadIcon,
  EjectIcon as LucideEjectIcon,
  EyeIcon as LucideEyeIcon,
  EyeOffIcon as LucideEyeOffIcon,
  FileIcon as LucideFileIcon,
  FileTextIcon as LucideFileTextIcon,
  FilmIcon as LucideFilmIcon,
  FlaskConicalIcon as LucideFlaskConicalIcon,
  FolderIcon as LucideFolderIcon,
  FolderOpenIcon as LucideFolderOpenIcon,
  Gamepad2Icon as LucideGamepad2Icon,
  GlobeIcon as LucideGlobeIcon,
  HomeIcon as LucideHomeIcon,
  HouseIcon as LucideHouseIcon,
  ImageIcon as LucideImageIcon,
  InfoIcon as LucideInfoIcon,
  KeyboardIcon as LucideKeyboardIcon,
  LayoutGridIcon as LucideLayoutGridIcon,
  ListIcon as LucideListIcon,
  LockIcon as LucideLockIcon,
  Maximize2Icon as LucideMaximize2Icon,
  MenuIcon as LucideMenuIcon,
  MicIcon as LucideMicIcon,
  MonitorIcon as LucideMonitorIcon,
  MoonIcon as LucideMoonIcon,
  MusicIcon as LucideMusicIcon,
  PackageIcon as LucidePackageIcon,
  PaletteIcon as LucidePaletteIcon,
  PinIcon as LucidePinIcon,
  PipetteIcon as LucidePipetteIcon,
  PlusIcon as LucidePlusIcon,
  PowerIcon as LucidePowerIcon,
  PrinterIcon as LucidePrinterIcon,
  PuzzleIcon as LucidePuzzleIcon,
  RefreshCwIcon as LucideRefreshCwIcon,
  RotateCcwIcon as LucideRotateCcwIcon,
  RotateCwIcon as LucideRotateCwIcon,
  SaveIcon as LucideSaveIcon,
  SearchIcon as LucideSearchIcon,
  ServerIcon as LucideServerIcon,
  SettingsIcon as LucideSettingsIcon,
  ShieldCheckIcon as LucideShieldCheckIcon,
  SlidersHorizontalIcon as LucideSlidersHorizontalIcon,
  SunIcon as LucideSunIcon,
  Trash2Icon as LucideTrash2Icon,
  TypeIcon as LucideTypeIcon,
  UsbIcon as LucideUsbIcon,
  UserIcon as LucideUserIcon,
  UserPlusIcon as LucideUserPlusIcon,
  VideoIcon as LucideVideoIcon,
  Volume2Icon as LucideVolume2Icon,
  VolumeXIcon as LucideVolumeXIcon,
  WifiIcon as LucideWifiIcon,
  WifiOffIcon as LucideWifiOffIcon,
  WrenchIcon as LucideWrenchIcon,
  XIcon as LucideXIcon,
  ZoomInIcon as LucideZoomInIcon,
  ZoomOutIcon as LucideZoomOutIcon,
} from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { SymbolicIcon } from "@/components/ui/symbolic-icon";
import type { SymbolicIconName } from "@/lib/shell/shell-icon-names";

function themed(name: SymbolicIconName, fallback: LucideIcon): LucideIcon {
  const Themed = (props: LucideProps) => <SymbolicIcon {...props} name={name} fallback={fallback} />;
  return Themed as unknown as LucideIcon;
}

export const AlertCircleIcon = themed("dialog-error", LucideAlertCircleIcon);
export const AlertTriangleIcon = themed("dialog-warning", LucideAlertTriangleIcon);
export const AppWindowIcon = themed("application-x-executable", LucideAppWindowIcon);
export const ArrowLeftIcon = themed("go-previous", LucideArrowLeftIcon);
export const ArrowRightIcon = themed("go-next", LucideArrowRightIcon);
export const ArrowUpCircleIcon = themed("software-update-available", LucideArrowUpCircleIcon);
export const ArrowUpIcon = themed("go-up", LucideArrowUpIcon);
export const BatteryChargingIcon = themed("battery-good-charging", LucideBatteryChargingIcon);
export const BatteryIcon = themed("battery-good", LucideBatteryIcon);
export const BellIcon = themed("preferences-system-notifications", LucideBellIcon);
export const BellRingIcon = themed("alarm", LucideBellRingIcon);
export const BlocksIcon = themed("application-x-addon", LucideBlocksIcon);
export const CalculatorIcon = themed("accessories-calculator", LucideCalculatorIcon);
export const CameraIcon = themed("camera-photo", LucideCameraIcon);
export const CheckIcon = themed("object-select", LucideCheckIcon);
export const ChevronDownIcon = themed("pan-down", LucideChevronDownIcon);
export const ChevronLeftIcon = themed("go-previous", LucideChevronLeftIcon);
export const ChevronRightIcon = themed("pan-end", LucideChevronRightIcon);
export const ChevronUpIcon = themed("pan-up", LucideChevronUpIcon);
export const ClockIcon = themed("document-open-recent", LucideClockIcon);
export const Columns2Icon = themed("view-dual", LucideColumns2Icon);
export const DownloadIcon = themed("folder-download", LucideDownloadIcon);
export const EjectIcon = themed("media-eject", LucideEjectIcon);
export const EyeIcon = themed("view-reveal", LucideEyeIcon);
export const EyeOffIcon = themed("view-conceal", LucideEyeOffIcon);
export const FileIcon = themed("text-x-generic", LucideFileIcon);
export const FileTextIcon = themed("x-office-document", LucideFileTextIcon);
export const FilmIcon = themed("video-x-generic", LucideFilmIcon);
export const FlaskConicalIcon = themed("applications-science", LucideFlaskConicalIcon);
export const FolderIcon = themed("folder", LucideFolderIcon);
export const FolderOpenIcon = themed("folder-open", LucideFolderOpenIcon);
export const Gamepad2Icon = themed("applications-games", LucideGamepad2Icon);
export const GlobeIcon = themed("web-browser", LucideGlobeIcon);
export const HomeIcon = themed("user-home", LucideHomeIcon);
export const HouseIcon = themed("user-home", LucideHouseIcon);
export const ImageIcon = themed("image-x-generic", LucideImageIcon);
export const InfoIcon = themed("help-about", LucideInfoIcon);
export const KeyboardIcon = themed("input-keyboard", LucideKeyboardIcon);
export const LayoutGridIcon = themed("view-grid", LucideLayoutGridIcon);
export const ListIcon = themed("view-list", LucideListIcon);
export const LockIcon = themed("system-lock-screen", LucideLockIcon);
export const Maximize2Icon = themed("view-fullscreen", LucideMaximize2Icon);
export const MenuIcon = themed("open-menu", LucideMenuIcon);
export const MicIcon = themed("audio-input-microphone", LucideMicIcon);
export const MonitorIcon = themed("video-display", LucideMonitorIcon);
export const MoonIcon = themed("weather-clear-night", LucideMoonIcon);
export const MusicIcon = themed("audio-x-generic", LucideMusicIcon);
export const PackageIcon = themed("package-x-generic", LucidePackageIcon);
export const PaletteIcon = themed("applications-graphics", LucidePaletteIcon);
export const PinIcon = themed("view-pin", LucidePinIcon);
export const PipetteIcon = themed("color-select", LucidePipetteIcon);
export const PlusIcon = themed("list-add", LucidePlusIcon);
export const PowerIcon = themed("system-shutdown", LucidePowerIcon);
export const PrinterIcon = themed("printer", LucidePrinterIcon);
export const PuzzleIcon = themed("application-x-addon", LucidePuzzleIcon);
export const RefreshCwIcon = themed("view-refresh", LucideRefreshCwIcon);
export const RotateCcwIcon = themed("object-rotate-left", LucideRotateCcwIcon);
export const RotateCwIcon = themed("object-rotate-right", LucideRotateCwIcon);
export const SaveIcon = themed("document-save", LucideSaveIcon);
export const SearchIcon = themed("system-search", LucideSearchIcon);
export const ServerIcon = themed("network-server", LucideServerIcon);
export const SettingsIcon = themed("emblem-system", LucideSettingsIcon);
export const ShieldCheckIcon = themed("security-high", LucideShieldCheckIcon);
export const SlidersHorizontalIcon = themed("preferences-system", LucideSlidersHorizontalIcon);
export const SunIcon = themed("weather-clear", LucideSunIcon);
export const Trash2Icon = themed("user-trash", LucideTrash2Icon);
export const TypeIcon = themed("font-x-generic", LucideTypeIcon);
export const UsbIcon = themed("drive-removable-media", LucideUsbIcon);
export const UserIcon = themed("avatar-default", LucideUserIcon);
export const UserPlusIcon = themed("contact-new", LucideUserPlusIcon);
export const VideoIcon = themed("camera-video", LucideVideoIcon);
export const Volume2Icon = themed("audio-volume-high", LucideVolume2Icon);
export const VolumeXIcon = themed("audio-volume-muted", LucideVolumeXIcon);
export const WifiIcon = themed("network-wireless-signal-excellent", LucideWifiIcon);
export const WifiOffIcon = themed("network-wireless-disabled", LucideWifiOffIcon);
export const WrenchIcon = themed("applications-utilities", LucideWrenchIcon);
export const XIcon = themed("window-close", LucideXIcon);
export const ZoomInIcon = themed("zoom-in", LucideZoomInIcon);
export const ZoomOutIcon = themed("zoom-out", LucideZoomOutIcon);
