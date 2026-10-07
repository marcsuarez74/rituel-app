import { useState } from 'react';
import type { FormEvent } from 'react';
import type { UserProfile } from '../lib/model';
import { addWeight, getWeights } from '../lib/storage';
import type { WeightEntry } from '../lib/storage';
import { formatDayMonth, todayISO } from '../lib/dates';
import { WeightChart } from './WeightChart';

// Carte « Suivi poids » de l'onglet Suivi : saisie, courbe, historique.
export function Pesees({
  profile,
  syncVersion = 0,
  onWeightsChanged,
}: {
  profile: UserProfile;
  syncVersion?: number;
  onWeightsChanged?: () => void;
}) {
  const [weights, setWeights] = useState<WeightEntry[]>(() => getWeights(profile.id));
  // Pattern render-phase reset : profil ou version de sync (pull remote) changé
  // → relire les pesées du storage.
  const [synced, setSynced] = useState({ profil: profile.id, version: syncVersion });
  const [date, setDate] = useState<string>(todayISO);
  const [kg, setKg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  if (synced.profil !== profile.id || synced.version !== syncVersion) {
    if (synced.profil !== profile.id) {
      setError(null);
      setKg('');
    }
    setSynced({ profil: profile.id, version: syncVersion });
    setWeights(getWeights(profile.id));
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = Number(kg);
    if (!kg || Number.isNaN(value) || value <= 0) {
      setError('Poids invalide.');
      return;
    }
    setError(null);
    setWeights(addWeight(profile.id, date, value));
    setKg('');
    onWeightsChanged?.();
  };

  return (
    <section className="profile-section pesee-card">
      <h2>Suivi poids</h2>
      <form className="weight-form" onSubmit={handleSubmit}>
        <input
          type="date"
          className="weight-date"
          name="date"
          aria-label="Date de la pesée"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          type="number"
          step="0.1"
          min="0"
          placeholder="Poids (kg)"
          name="kg"
          aria-label="Poids (kg)"
          value={kg}
          onChange={(e) => {
            setError(null);
            setKg(e.target.value);
          }}
        />
        <button type="submit">Ajouter</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <WeightChart weights={weights} objectif={profile.poidsObjectif} />
      <ul className="weight-list">
        {[...weights].reverse().map((w) => (
          <li key={w.date}>
            {formatDayMonth(w.date)} — {w.kg} kg
          </li>
        ))}
      </ul>
    </section>
  );
}
