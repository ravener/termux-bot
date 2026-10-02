import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CACHE_DIR = join('data', 'repos');
const CACHE_EXPIRY = 6 * 60 * 60 * 1000; // 6 Hours

if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR);
}

export const validRepos = ['main', 'x11', 'root', 'glibc', 'tur'] as const;
export type Repository = typeof validRepos[number];

export const validArch = ['aarch64', 'arm', 'i686', 'x86_64'] as const;
export type Arch = typeof validArch[number];

export interface PackageHashes {
    md5: string;
    sha1: string;
    sha256: string;
    sha512: string;
}

export interface PackageInfo {
    name: string;
    description: string;
    version: string;
    architecture: Arch;
    maintainer: string;
    homepage: string;
    filename: string;
    size: number;
    installedSize: number;
    replaces: string | undefined;
    depends: string | undefined;
    breaks: string | undefined;
    conflicts: string | undefined;
    suggests: string | undefined;
    provides: string | undefined;
    essential: boolean;
    hashes: PackageHashes;
}

const REPO_URL = 'https://packages-cf.termux.dev/apt';
const TUR_URL = 'https://tur.kcubeterm.com';

export function getDownloadURL(repo: Repository, filename: string) {
    if (repo === 'tur') {
        return `${TUR_URL}/${filename}`;
    }

    return `${REPO_URL}/termux-${repo}/${filename}`;
}

function getURL(repo: Repository, arch: Arch) {
    if (repo === 'tur') {
        return `${TUR_URL}/dists/tur-packages/tur/binary-${arch}/Packages`;
    }

    let dir = ['stable', 'main'];

    if (repo === 'x11') dir = ['x11', 'main'];
    if (repo === 'root') dir = ['root', 'stable'];
    if (repo === 'glibc') dir = ['glibc', 'stable'];

    return `${REPO_URL}/termux-${repo}/dists/${dir[0]}/${dir[1]}/binary-${arch}/Packages`;
}

function parseIndex(index: string) {
    const packages = new Map<string, PackageInfo>();

    for (const paragraph of index.trim().split(/\n\n+/)) {
        const fields = new Map<string, string>();

        for (const line of paragraph.split('\n')) {
            const separator = line.indexOf(':');

            if (separator === -1) continue;

            const key = line.slice(0, separator);
            const value = line.slice(separator + 1).trim();

            fields.set(key, value);
        }

        const name = fields.get('Package');
        if (!name) continue;

        const packageInfo: PackageInfo = {
            name,
            installedSize: Number(fields.get('Installed-Size')),
            maintainer: fields.get('Maintainer')!,
            architecture: fields.get('Architecture')! as Arch,
            version: fields.get('Version')!,

            replaces: fields.get('Replaces'),
            depends: fields.get('Depends'),
            breaks: fields.get('Breaks'),
            conflicts: fields.get('Conflicts'),
            suggests: fields.get('Suggests'),
            provides: fields.get('Provides'),

            filename: fields.get('Filename')!,
            size: Number(fields.get('Size')),

            hashes: {
                md5: fields.get('MD5sum')!,
                sha1: fields.get('SHA1')!,
                sha256: fields.get('SHA256')!,
                sha512: fields.get('SHA512')!
            },

            description: fields.get('Description')!,
            homepage: fields.get('Homepage')!,
            essential: fields.get('Essential') === 'yes' ? true : false
        };

        packages.set(name, packageInfo);
    }

    return packages;
}

export async function getRepository(repo: Repository, arch: Arch) {
    const filepath = join(CACHE_DIR, `${repo}-${arch}`);

    if (existsSync(filepath)) {
        const { mtimeMs } = await stat(filepath);

        if ((Date.now() - mtimeMs < CACHE_EXPIRY) || process.env.NODE_ENV === 'development') {
            return parseIndex(await readFile(filepath, 'utf8'));
        }
    }

    const response = await fetch(getURL(repo, arch));
    if (!response.ok) {
        throw new Error(`Failed to request package index: ${response.status} ${response.statusText}`);
    }

    const body = await response.text();
    await writeFile(filepath, body);

    return parseIndex(body);
}
