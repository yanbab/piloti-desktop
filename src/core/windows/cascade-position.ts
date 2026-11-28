/** Where a new window opens: after the last one, where it was, or centred. */
export function computeCenteredOrCascadedPosition(
  existingPositions: Array<{ x: number; y: number }>,
  size: { width: number; height: number },
  screenWidth: number,
  screenHeight: number,
  rememberedPosition?: { x: number; y: number }
): { x: number; y: number } {
  if (existingPositions.length > 0) {
    const last = existingPositions[existingPositions.length - 1];
    return { x: last.x + 24, y: last.y + 24 };
  }
  if (rememberedPosition) {
    return rememberedPosition;
  }
  return {
    x: Math.max(0, Math.round((screenWidth - size.width) / 2)),
    y: Math.max(0, Math.round((screenHeight - 30 - size.height) / 2)),
  };
}
