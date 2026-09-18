import { useState } from 'react';
import type { UserProfile, WeeklyData } from '../../lib/model';
import { BatchView } from './BatchView';
import { CoursesBudget, DepensesPanel } from './CoursesBudget';
import { MenuView } from './MenuView';
import { ShoppingList } from './ShoppingList';

type CuisineTab = 'courses' | 'menu' | 'batch';

const TABS: Array<{ id: CuisineTab; label: string }> = [
  { id: 'courses', label: 'Courses' },
  { id: 'menu', label: 'Menu' },
  { id: 'batch', label: 'Mon Rituel' },
];

export function CuisineView({
  data,
  profile,
  syncVersion = 0,
}: {
  data: WeeklyData;
  profile: UserProfile;
  syncVersion?: number;
}) {
  const [tab, setTab] = useState<CuisineTab>('courses');
  const [depOuvert, setDepOuvert] = useState(false);
  const [depFocus, setDepFocus] = useState(false);
  const semaine = data.meta.semaine;
  return (
    <>
      <nav className="cuisine-tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={id === tab ? 'tab active' : 'tab'}
            aria-current={id === tab ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'courses' &&
        (depOuvert ? (
          <DepensesPanel
            profile={profile}
            focusTotal={depFocus}
            syncVersion={syncVersion}
            onRetour={() => setDepOuvert(false)}
          />
        ) : (
          <>
            <CoursesBudget
              data={data}
              profile={profile}
              syncVersion={syncVersion}
              onOuvrirDepenses={(focus) => {
                setDepFocus(focus);
                setDepOuvert(true);
              }}
            />
            <ShoppingList
              items={data.courses}
              semaine={semaine}
              budget={data.budget}
              syncVersion={syncVersion}
            />
          </>
        ))}
      {tab === 'menu' && (
        <MenuView
          menu={data.menu}
          recettes={data.recettes}
          bases={data.bases}
          semaine={semaine}
          syncVersion={syncVersion}
        />
      )}
      {tab === 'batch' && (
        <BatchView
          rituel={data.rituel}
          microBatch={data.microBatch}
          reserve={data.reserve}
          production={data.rituelProduction}
          termine={data.rituelTermine}
          semaine={semaine}
          syncVersion={syncVersion}
        />
      )}
    </>
  );
}
