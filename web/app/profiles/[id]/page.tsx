import WrestlerView from "./wrestler-view";
import { api } from "@/lib/api";

export async function generateStaticParams() {
    try {
        const wrestlers = await api.getWrestlers();
        return wrestlers.map((w) => ({
            id: String(w.id),
        }));
    } catch (e) {
        console.error("Failed to generate static params for profiles:", e);
        return [];
    }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <WrestlerView id={id} />;
}
