import { readFile } from 'node:fs/promises';

export interface Tag {
    name: string;
    aliases: string[];
    content: string[] | string;
}

export async function readTagsFile() {
    const data = JSON.parse(await readFile('data/tags.json', 'utf8'));
    return data as Tag[];
}

export function listAvailableTags(tags: Tag[]) {
    return tags
        .map(tag => {
            if (tag.aliases.length) {
                return `${tag.name} (${tag.aliases.join(', ')})`;
            }

            return tag.name;
        })
        .join(', ');
}
