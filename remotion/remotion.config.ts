import { Config } from '@remotion/cli/config';

// ─── Remotion Configuration ───
// See: https://www.remotion.dev/docs/config

// Entry point — must call registerRoot()
Config.setEntryPoint('src/entry.tsx');

// Output codec for renders
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// Increase browser timeout for heavy compositions
Config.setChromiumOpenGlRenderer('angle');

// Output directory for rendered files
Config.setOutputLocation('out');
