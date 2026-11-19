// Device profile, decided once at load.
// A phone (touch screen, small side under 600 px) gets a lighter engine setup:
// default tile memory, automatic graphics level, no shadows and no 3D trees.
// Mobile browsers refuse large wasm allocations and their GPUs drop frames
// with shadows on.

export const PHONE = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 600;
