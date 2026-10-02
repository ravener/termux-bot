

export interface WikiPage {
    title: string;
    fullurl: string;
}

interface ResponseBody {
    query?: {
        pages?: Record<string, WikiPage>;
    }
}

const API_URL = 'https://wiki.termux.dev/api.php';

export async function searchWiki(query: string): Promise<WikiPage[]> {
    const qs = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: query,
        gsrwhat: 'text',
        prop: 'info',
        inprop: 'url',
        format: 'json'
    });

    const response = await fetch(`${API_URL}?${qs}`);
    if (!response.ok) {
        throw new Error(`Error requesting wiki: ${response.status} ${response.statusText}`);
    }

    const body = await response.json() as ResponseBody;
    return Object.values(body.query?.pages ?? {});
}
