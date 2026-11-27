/** Battery icons are orange in power saver mode, whatever the accent. */
export const batteryTone = (powerMode: string) =>
  powerMode === "power-saver" ? "[&_svg]:text-ui-orange" : undefined;
