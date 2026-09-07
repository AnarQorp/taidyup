import fs from 'node:fs';
import path from 'node:path';
import { execFile, type ExecFileOptions } from 'node:child_process';

export type DirectoryPickerResult =
  | { status: 'SELECTED'; path: string }
  | { status: 'CANCELLED' }
  | { status: 'PICKER_UNAVAILABLE'; message: string }
  | { status: 'PICKER_FAILED'; message: string };

export interface PickerCommand { file: string; args: string[] }
type Runner = (file: string, args: string[], options: ExecFileOptions, callback: (error: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void) => void;

export const PICKER_TIMEOUT_MS = 60_000;
export const PICKER_MAX_OUTPUT_BYTES = 8 * 1024;

export function pickerCommands(platform = process.platform): PickerCommand[] {
  if (platform === 'darwin') return [{ file: '/usr/bin/osascript', args: ['-e', 'POSIX path of (choose folder with prompt "Choose a local project")'] }];
  if (platform === 'win32') return [{ file: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){[Console]::Out.Write($d.SelectedPath)}else{exit 1}'] }];
  if (platform === 'linux') return [
    { file: 'zenity', args: ['--file-selection', '--directory', '--title=Choose a local project'] },
    { file: 'kdialog', args: ['--getexistingdirectory', '.', '--title', 'Choose a local project'] }
  ];
  return [];
}

function run(command: PickerCommand, runner: Runner): Promise<{ stdout: string; unavailable: boolean; cancelled: boolean; failed: boolean }> {
  return new Promise(resolve => runner(command.file, command.args, { timeout: PICKER_TIMEOUT_MS, maxBuffer: PICKER_MAX_OUTPUT_BYTES, windowsHide: false }, (error, stdout, stderr) => {
    if (!error) return resolve({ stdout, unavailable: false, cancelled: false, failed: false });
    const unavailable = error.code === 'ENOENT' || /cannot open display|display not set|could not connect to display/i.test(stderr);
    const cancelled = !unavailable && (error.code === '1' || (error as any).code === 1);
    resolve({ stdout: '', unavailable, cancelled, failed: !unavailable && !cancelled });
  }));
}

export async function selectLocalDirectory(options: { platform?: NodeJS.Platform; runner?: Runner } = {}): Promise<DirectoryPickerResult> {
  const commands = pickerCommands(options.platform);
  if (!commands.length) return { status: 'PICKER_UNAVAILABLE', message: 'No supported native directory picker is available on this platform. Enter the local path manually.' };
  const runner = options.runner || (execFile as unknown as Runner);
  for (const command of commands) {
    const result = await run(command, runner);
    if (result.unavailable) continue;
    if (result.cancelled) return { status: 'CANCELLED' };
    if (result.failed) return { status: 'PICKER_FAILED', message: 'The directory picker failed or timed out. Enter the local path manually.' };
    const output = result.stdout.trim();
    if (!output) return { status: 'CANCELLED' };
    if (Buffer.byteLength(output) > PICKER_MAX_OUTPUT_BYTES || /[\r\n]/.test(output)) return { status: 'PICKER_FAILED', message: 'The directory picker returned an invalid path. Enter the local path manually.' };
    if (!path.isAbsolute(output)) return { status: 'PICKER_FAILED', message: 'The directory picker did not return an absolute path. Enter the local path manually.' };
    let selected: string;
    try { selected = fs.realpathSync(output); } catch { return { status: 'PICKER_FAILED', message: 'The selected directory is not available. Enter the local path manually.' }; }
    if (!fs.statSync(selected).isDirectory()) return { status: 'PICKER_FAILED', message: 'The selected path is not a directory. Enter the local path manually.' };
    return { status: 'SELECTED', path: selected };
  }
  return { status: 'PICKER_UNAVAILABLE', message: 'No supported native directory picker is installed or available in this session. Enter the local path manually.' };
}
