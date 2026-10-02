import type { Tag } from '#lib/tags';

declare module '@sapphire/pieces' {
    interface Container {
        tags: Tag[];
    }
}
