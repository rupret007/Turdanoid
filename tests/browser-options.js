export function browserLaunchOptions() {
  return {
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
    // Software rendering keeps real browser geometry and input assertions
    // usable on Linux runners without a working GPU service.
    args: process.platform === 'linux' ? ['--disable-gpu', '--disable-gpu-compositing'] : []
  };
}
