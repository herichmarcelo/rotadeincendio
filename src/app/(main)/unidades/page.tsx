import { UnidadesClient } from "./UnidadesClient";

export default function UnidadesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Unidades e setores</h1>
        <p className="text-sm text-zinc-400">Organize locais e setores vinculados a cada unidade.</p>
      </div>
      <UnidadesClient />
    </div>
  );
}
