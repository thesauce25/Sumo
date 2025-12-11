import WrestlerView from "./wrestler-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <WrestlerView id={parseInt(id)} />;
}
