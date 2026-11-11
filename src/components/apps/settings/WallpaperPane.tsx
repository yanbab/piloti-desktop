import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  GroupedForm,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormSection,
  GroupedFormSectionTitle,
} from "@/components/ui/grouped-form";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/context/DesktopStateContext";
import { WALLPAPERS } from "@/data/catalog";
import { cn } from "@/lib/utils";

export function WallpaperPane() {
  const { settings, updateSettings, activeWallpaper } = useSettings();
  const [customUrlDraft, setCustomUrlDraft] = React.useState(
    settings.customWallpaperUrl
  );

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>Current Wallpaper</GroupedFormSectionTitle>
        <div className="flex items-center gap-4 rounded-[14px] border border-mac-separator bg-mac-group p-3.5">
          <div
            className="h-24 w-40 shrink-0 rounded-[10px] border border-white/20 shadow-md"
            style={{
              background: settings.customWallpaperUrl
                ? `url(${settings.customWallpaperUrl}) center/cover no-repeat`
                : activeWallpaper.backgroundCss,
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold">
              {settings.customWallpaperUrl
                ? "Custom Image Wallpaper"
                : activeWallpaper.name}
            </div>
            <div className="mt-0.5 text-[12px] text-mac-label-secondary">
              {settings.customWallpaperUrl
                ? settings.customWallpaperUrl.slice(0, 64)
                : activeWallpaper.subtitle}
            </div>
            <span className="mt-2 inline-block rounded-full bg-mac-accent/15 px-2.5 py-0.5 text-[11px] font-medium text-mac-accent">
              {activeWallpaper.category}
            </span>
          </div>
        </div>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>Curated Wallpapers</GroupedFormSectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {WALLPAPERS.map((wp) => {
            const selected =
              !settings.customWallpaperUrl && settings.wallpaperId === wp.id;
            return (
              <button
                key={wp.id}
                type="button"
                onClick={() =>
                  updateSettings({
                    wallpaperId: wp.id,
                    customWallpaperUrl: "",
                  })
                }
                className={cn(
                  "group flex flex-col overflow-hidden rounded-[12px] border p-1.5 text-left transition-all",
                  selected
                    ? "border-mac-accent bg-mac-accent/10 ring-2 ring-mac-accent/40"
                    : "border-mac-separator bg-mac-group hover:border-white/30"
                )}
              >
                <div
                  className="h-20 w-full rounded-[8px] shadow-inner transition-transform duration-300 group-hover:scale-[1.02]"
                  style={{ background: wp.backgroundCss }}
                />
                <div className="mt-1.5 px-1">
                  <div className="truncate text-[12px] font-semibold">
                    {wp.name}
                  </div>
                  <div className="truncate text-[10px] text-mac-label-secondary">
                    {wp.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>Custom Wallpaper URL</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow className="gap-2 py-3">
            <Input
              placeholder="https://images.unsplash.com/..."
              value={customUrlDraft}
              onChange={(e) => setCustomUrlDraft(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() =>
                updateSettings({ customWallpaperUrl: customUrlDraft.trim() })
              }
            >
              Apply URL
            </Button>
            {settings.customWallpaperUrl && (
              <Button
                variant="secondary"
                onClick={() => {
                  setCustomUrlDraft("");
                  updateSettings({ customWallpaperUrl: "" });
                }}
              >
                Reset
              </Button>
            )}
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}

