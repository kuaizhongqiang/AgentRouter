/**
 * AgentRouter — 项目初始化器 (Issue #22)
 *
 * 扫描项目目录，检测技术栈，生成项目画像并存入 memories 表。
 * 供 Onboarding 和 CLI `ar project init` 调用。
 */
import fs from 'fs';
import path from 'path';
import * as repo from './database/repository';

export interface ProjectProfile {
  techStack: string[];
  fileCount: number;
  dirCount: number;
  hasReadme: boolean;
  readmePreview: string;
  hasGit: boolean;
  dependencies: Record<string, string>;
  detectedAt: string;
}

/** 检测技术栈 */
function detectTechStack(projectPath: string): string[] {
  const stack: string[] = [];
  const files = fs.readdirSync(projectPath);

  for (const f of files) {
    const lower = f.toLowerCase();
    if (lower === 'package.json') {
      stack.push('Node.js');
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, f), 'utf-8'));
        if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) stack.push('TypeScript');
        if (pkg.dependencies?.react || pkg.devDependencies?.react) stack.push('React');
        if (pkg.dependencies?.vue || pkg.devDependencies?.vue) stack.push('Vue');
        if (pkg.dependencies?.next || pkg.devDependencies?.next) stack.push('Next.js');
        if (pkg.dependencies?.express) stack.push('Express');
        if (pkg.dependencies?.electron) stack.push('Electron');
      } catch { /* ignore parse errors */ }
    } else if (lower === 'cargo.toml') {
      stack.push('Rust');
    } else if (lower === 'go.mod') {
      stack.push('Go');
    } else if (lower === 'pyproject.toml' || lower === 'requirements.txt') {
      stack.push('Python');
    } else if (lower.endsWith('.sln') || lower.endsWith('.csproj')) {
      stack.push('.NET');
    } else if (lower === 'makefile' || lower === 'cmakelists.txt') {
      stack.push('C/C++');
    } else if (lower === 'dockerfile' || lower === 'docker-compose.yml' || lower === 'docker-compose.yaml') {
      stack.push('Docker');
    }
  }

  return [...new Set(stack)];
}

/** 读取主要依赖摘要 */
function readDependencies(projectPath: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const pkgPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      // 只取前 20 个主要依赖作为摘要
      let count = 0;
      for (const [name, ver] of Object.entries(allDeps)) {
        if (count >= 20) break;
        deps[name as string] = String(ver);
        count++;
      }
    } catch { /* ignore */ }
  }
  return deps;
}

/**
 * 快速初始化项目：扫描目录、检测技术栈、存储画像
 * @param projectId 项目 ID（用于存 memories）
 * @param projectPath 项目文件系统路径
 * @returns 项目画像
 */
export async function quickInit(projectId: string, projectPath: string): Promise<ProjectProfile> {
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  const techStack = detectTechStack(projectPath);
  const dependencies = readDependencies(projectPath);

  // 统计文件/目录数
  let fileCount = 0;
  let dirCount = 0;
  let hasReadme = false;
  let readmePreview = '';

  try {
    const entries = fs.readdirSync(projectPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;
      if (entry.isDirectory()) dirCount++;
      else fileCount++;

      // README 预览
      const lower = entry.name.toLowerCase();
      if (!hasReadme && (lower === 'readme.md' || lower === 'readme' || lower === 'readme.txt')) {
        hasReadme = true;
        try {
          const content = fs.readFileSync(path.join(projectPath, entry.name), 'utf-8');
          readmePreview = content.replace(/[#*`\[\]]/g, '').trim().slice(0, 300);
        } catch { /* ignore */ }
      }
    }
  } catch { /* directory may not be readable */ }

  const profile: ProjectProfile = {
    techStack,
    fileCount,
    dirCount,
    hasReadme,
    readmePreview,
    hasGit: fs.existsSync(path.join(projectPath, '.git')),
    dependencies,
    detectedAt: new Date().toISOString(),
  };

  // 存入 memories，key=_project_profile，agentName=_system
  await repo.saveMemory(projectId, '_system', '_project_profile', JSON.stringify(profile, null, 2));

  console.log(`[ProjectInit] ${projectPath} — ${techStack.join(', ') || 'unknown'} (${fileCount} files, ${dirCount} dirs)`);
  return profile;
}
