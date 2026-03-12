#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { REQ_KEYS, getCredentials, queryTask } from './common';

type Mode = 'image' | 'video';

interface ParsedArgs {
  mode: Mode;
  prompt: string;
  forwardArgs: string[];
}

interface BaseResult {
  success: boolean;
  taskId?: string;
  submitted?: boolean;
  pending?: boolean;
  folder?: string;
  outputDir?: string;
  message?: string;
  [key: string]: unknown;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const mode = args[0];
  const prompt = args[1];

  if ((mode !== 'image' && mode !== 'video') || !prompt) {
    console.error('用法: ts-node scripts/openclaw-jimeng.ts <image|video> "提示词" [原始即梦参数]');
    process.exit(1);
  }

  return {
    mode,
    prompt,
    forwardArgs: args.slice(2)
  };
}

function runUnderlyingScript(mode: Mode, prompt: string, forwardArgs: string[]): BaseResult {
  const scriptName = mode === 'image' ? 'text2image.ts' : 'text2video.ts';
  const workspaceRoot = path.resolve(__dirname, '..', '..');
  const sourceScriptPath = path.join(workspaceRoot, 'scripts', scriptName);
  const tsNodeBin = path.join(workspaceRoot, 'node_modules', '.bin', 'ts-node');
  const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
  const child = spawnSync(tsNodeBin, ['--project', tsconfigPath, sourceScriptPath, prompt, ...forwardArgs], {
    cwd: workspaceRoot,
    env: process.env,
    encoding: 'utf8'
  });

  if (child.stderr) {
    process.stderr.write(child.stderr);
  }

  if (child.error) {
    throw child.error;
  }

  const raw = child.stdout.trim();
  if (!raw) {
    throw new Error(`${scriptName} 未输出 JSON 结果`);
  }

  try {
    return JSON.parse(raw) as BaseResult;
  } catch (error) {
    throw new Error(`${scriptName} 输出不是合法 JSON: ${raw}`);
  }
}

function ensureArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function toRelativeOutputPath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = '/output/';
  const idx = normalized.indexOf(marker);
  if (idx === -1) {
    return null;
  }
  return normalized.slice(idx + marker.length);
}

function toPublicUrl(filePath: string): string | null {
  const baseUrl = process.env.JIMENG_PUBLIC_BASE_URL;
  if (!baseUrl) {
    return null;
  }

  const relativePath = toRelativeOutputPath(filePath);
  if (!relativePath) {
    return null;
  }

  return `${baseUrl.replace(/\/+$/, '')}/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

function dedupe(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function imageReqKey(version: unknown): string {
  switch (version) {
    case 'v30':
      return REQ_KEYS.T2I_V30;
    case 'v40':
      return REQ_KEYS.T2I_V40;
    case 'v31':
    default:
      return REQ_KEYS.T2I_V31;
  }
}

function videoReqKey(result: BaseResult): string {
  const direct = result.req_key;
  if (typeof direct === 'string' && direct.length > 0) {
    return direct;
  }

  return result.model === 'pro' ? REQ_KEYS.TI2V_V30_PRO : REQ_KEYS.T2V_V30_1080P;
}

async function fetchRemoteUrls(mode: Mode, result: BaseResult): Promise<string[]> {
  if (!result.taskId) {
    return [];
  }

  const { accessKey, secretKey, securityToken } = getCredentials();
  const reqKey = mode === 'image' ? imageReqKey(result.version) : videoReqKey(result);
  const queried = await queryTask(accessKey, secretKey, reqKey, result.taskId, securityToken);
  const data = queried?.data;

  if (mode === 'image') {
    const fromImageUrls = ensureArray(data?.image_urls);
    const fromPeResult = Array.isArray(data?.pe_result)
      ? data.pe_result.map(item => item?.url).filter((item): item is string => typeof item === 'string')
      : [];
    return dedupe([...fromImageUrls, ...fromPeResult]);
  }

  return dedupe([typeof data?.video_url === 'string' ? data.video_url : null]);
}

function buildText(
  mode: Mode,
  prompt: string,
  status: 'submitted' | 'pending' | 'completed',
  taskId: string | undefined,
  remoteUrls: string[],
  publicUrls: string[],
  localFiles: string[]
): string {
  const lines: string[] = [];
  lines.push(`即梦${mode === 'image' ? '图片' : '视频'}任务${status === 'completed' ? '已完成' : '处理中'}`);
  lines.push(`提示词: ${prompt}`);
  if (taskId) {
    lines.push(`TaskId: ${taskId}`);
  }

  if (status !== 'completed') {
    lines.push('可稍后用相同提示词再次查询结果。');
  }

  if (remoteUrls.length > 0) {
    lines.push('远程直链:');
    remoteUrls.forEach((url, index) => lines.push(`${index + 1}. ${url}`));
  }

  if (publicUrls.length > 0) {
    lines.push('公开分享链接:');
    publicUrls.forEach((url, index) => lines.push(`${index + 1}. ${url}`));
  }

  if (localFiles.length > 0) {
    lines.push('本地文件:');
    localFiles.forEach((file, index) => lines.push(`${index + 1}. ${file}`));
  }

  if (remoteUrls.length === 0 && publicUrls.length === 0 && localFiles.length === 0) {
    lines.push('当前暂无可查看文件。');
  }

  return lines.join('\n');
}

function resolveLocalFiles(mode: Mode, result: BaseResult): string[] {
  if (mode === 'image') {
    return ensureArray(result.images);
  }

  if (typeof result.localVideo === 'string') {
    return [result.localVideo];
  }

  if (typeof result.outputDir === 'string' && fs.existsSync(result.outputDir)) {
    const candidates = fs.readdirSync(result.outputDir)
      .filter(file => /\.(mp4|mov|avi)$/i.test(file))
      .map(file => path.join(result.outputDir as string, file));
    return candidates;
  }

  return [];
}

async function main(): Promise<void> {
  const { mode, prompt, forwardArgs } = parseArgs();
  const base = runUnderlyingScript(mode, prompt, forwardArgs);

  const localFiles = resolveLocalFiles(mode, base);
  const directRemoteUrls = mode === 'video'
    ? dedupe([typeof base.videoUrl === 'string' ? base.videoUrl : null])
    : [];
  const fetchedRemoteUrls = base.success ? await fetchRemoteUrls(mode, base).catch(() => []) : [];
  const remoteUrls = dedupe([...directRemoteUrls, ...fetchedRemoteUrls]);
  const publicUrls = dedupe(localFiles.map(file => toPublicUrl(file)));

  const status: 'submitted' | 'pending' | 'completed' =
    base.submitted ? 'submitted' : base.pending ? 'pending' : 'completed';

  const result = {
    success: base.success,
    type: mode,
    status,
    prompt,
    taskId: typeof base.taskId === 'string' ? base.taskId : undefined,
    localFiles,
    remoteUrls,
    publicUrls,
    channels: {
      feishu: { viewUrls: publicUrls.length > 0 ? publicUrls : remoteUrls },
      wecom: { viewUrls: publicUrls.length > 0 ? publicUrls : remoteUrls },
      dingtalk: { viewUrls: publicUrls.length > 0 ? publicUrls : remoteUrls }
    },
    text: buildText(mode, prompt, status, typeof base.taskId === 'string' ? base.taskId : undefined, remoteUrls, publicUrls, localFiles),
    raw: base
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: Error) => {
  const result = {
    success: false,
    error: {
      code: 'OPENCLAW_JIMENG_ERROR',
      message: error.message
    }
  };
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
});
