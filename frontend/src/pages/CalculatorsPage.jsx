import { AccommodationCard, PrismCard, DemandCard } from "@/components/calc/BasicCards";
import { RefractionCard, ACACard } from "@/components/calc/OpticsCards";
import { PrismCriteriaCard, NormsTable } from "@/components/calc/ClinicalCards";
import { ContactLensCard } from "@/components/calc/ContactLensCard";
import { OriHero } from "@/components/ori/OriAvatar";
import { useApp } from "@/context/AppContext";
import { SortableList, applyOrder, useOrder } from "@/components/common/Sortable";

const CARDS = [
  { id: "accommodation", C: AccommodationCard },
  { id: "demand", C: DemandCard },
  { id: "prism", C: PrismCard },
  { id: "refraction", C: RefractionCard },
  { id: "aca", C: ACACard },
  { id: "prism-criteria", C: PrismCriteriaCard },
  { id: "contact-lens", C: ContactLensCard },
  { id: "norms", C: NormsTable, wide: true },
];

export default function CalculatorsPage() {
  const { profile } = useApp();
  const [order, saveOrder] = useOrder(`calcs:${profile.id}`);
  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFC]" data-testid="calculators-page">
      <div className="mx-auto max-w-7xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <OriHero expression="idea" className="h-28" />
          <div>
            <h1 className="ori-title text-3xl sm:text-4xl font-bold tracking-tight text-[#1B2A3A]">Calculadoras clínicas</h1>
            <p className="text-slate-500 text-sm">Cálculos deterministas (sin IA), con su fórmula y referencia. Verifica siempre el resultado clínicamente. Reordena las tarjetas con el asa.</p>
          </div>
        </div>
        <SortableList items={applyOrder(CARDS, order)} onReorder={saveOrder} testPrefix="calc-sort" className="grid gap-6 lg:grid-cols-2"
          itemClassName={(c) => (c.wide ? "lg:col-span-2" : "")}
          render={({ C }, grip) => (
            <div className="relative h-full">
              <div className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-1 shadow-sm">{grip}</div>
              <C />
            </div>
          )} />
      </div>
    </div>
  );
}
