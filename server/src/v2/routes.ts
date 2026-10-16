import { Hono } from 'hono';
import { CONTRAT } from './contrat.js';

// API de l'app native, montée sous /v2 par creerApp (avant la PWA).
export const creerRoutesV2 = (): Hono => {
  const v2 = new Hono();

  v2.get('/contrat', (c) => c.json({ contrat: CONTRAT }));

  // Toujours en dernier : une route /v2 inconnue ne doit jamais tomber sur la PWA.
  v2.all('*', (c) => c.json({ erreur: 'introuvable' }, 404));
  return v2;
};
