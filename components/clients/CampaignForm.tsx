'use client';
/**
 * Find clients: one campaign, what the owner sells and to whom. AIBOS judges
 * the fit and writes every message from it, so each field says in plain
 * words what it is used for.
 */
import { useState } from 'react';
import { Note, Segmented } from '@/components/hospitality/kit';
import type { ClientCampaignFields } from '@/lib/api';
import { Field, Group, PickChips, said, toLines, toWords } from './shared';

export const EMPTY_CAMPAIGN: ClientCampaignFields = {
  name: '', offer: null, who: null, pain: null, proof: null,
  good_fit: [], rule_out: [], keywords: [], kinds: [], towns: [], status: 'active',
};

export default function CampaignForm({ initial, kinds, towns, saveLabel = 'Save', onSave, onCancel }: {
  initial: ClientCampaignFields;
  kinds: Record<string, string>;
  towns: string[];
  saveLabel?: string;
  onSave: (fields: ClientCampaignFields) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial.name ?? '');
  const [offer, setOffer] = useState(initial.offer ?? '');
  const [who, setWho] = useState(initial.who ?? '');
  const [pain, setPain] = useState(initial.pain ?? '');
  const [proof, setProof] = useState(initial.proof ?? '');
  const [goodFit, setGoodFit] = useState((initial.good_fit ?? []).join('\n'));
  const [ruleOut, setRuleOut] = useState((initial.rule_out ?? []).join('\n'));
  const [keywords, setKeywords] = useState((initial.keywords ?? []).join(', '));
  const [pickedKinds, setPickedKinds] = useState<string[]>(initial.kinds ?? []);
  const [pickedTowns, setPickedTowns] = useState<string[]>(initial.towns ?? []);
  const [status, setStatus] = useState<'active' | 'paused'>(initial.status === 'paused' ? 'paused' : 'active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give the campaign a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        offer: offer.trim() || null,
        who: who.trim() || null,
        pain: pain.trim() || null,
        proof: proof.trim() || null,
        good_fit: toLines(goodFit),
        rule_out: toLines(ruleOut),
        keywords: toWords(keywords),
        kinds: pickedKinds,
        towns: pickedTowns,
        status,
      });
    } catch (err) {
      setError(said(err, 'The campaign could not be saved just now. Try again in a moment.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="rs-form" style={{ alignItems: 'start', gap: 18 }}>
      <Field label="Name" wide>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
          placeholder="For example: Hardware shops in Lusaka" />
      </Field>
      <Field label="What you offer" wide hint="In one or two sentences, as you would say it to a customer.">
        <textarea className="field" rows={2} value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={600} />
      </Field>
      <Field label="Who it is for">
        <textarea className="field" rows={2} value={who} onChange={(e) => setWho(e.target.value)} maxLength={600}
          placeholder="Owners of shops with more than one till" />
      </Field>
      <Field label="The problem it solves">
        <textarea className="field" rows={2} value={pain} onChange={(e) => setPain(e.target.value)} maxLength={600}
          placeholder="They do not know their profit until month end" />
      </Field>
      <Field label="Proof" wide hint="A result or a customer you can name. AIBOS never makes one up: it uses only what you write here.">
        <textarea className="field" rows={2} value={proof} onChange={(e) => setProof(e.target.value)} maxLength={600} />
      </Field>
      <Field label="Signs of a good fit" hint="One a line.">
        <textarea className="field" rows={3} value={goodFit} onChange={(e) => setGoodFit(e.target.value)}
          placeholder={'Has more than one branch\nSells on credit'} />
      </Field>
      <Field label="Leave them alone if" hint="One a line.">
        <textarea className="field" rows={3} value={ruleOut} onChange={(e) => setRuleOut(e.target.value)}
          placeholder={'Government office\nAlready uses us'} />
      </Field>
      <Field label="Words to look for on their website" wide hint="Separated by commas. Each one found raises the fit.">
        <input className="field" value={keywords} onChange={(e) => setKeywords(e.target.value)}
          placeholder="wholesale, branches, delivery" />
      </Field>
      <Group label="Kinds of business to look for on the map">
        <PickChips label="Kinds of business" value={pickedKinds} onChange={setPickedKinds}
          options={Object.entries(kinds).map(([value, label]) => ({ value, label }))} />
      </Group>
      <Group label="Towns">
        <PickChips label="Towns" value={pickedTowns} onChange={setPickedTowns}
          options={towns.map((t) => ({ value: t, label: t }))} />
      </Group>
      <Group label="Status" hint="A paused campaign keeps its businesses; AIBOS just stops adding to it.">
        <Segmented label="Status" value={status} onChange={setStatus}
          options={[{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }]} />
      </Group>
      <div style={{ gridColumn: '1 / -1' }}>
        {error && <Note tone="bad">{error}</Note>}
        <div className="rs-btns" style={{ marginTop: error ? 16 : 4 }}>
          <button type="submit" className="rs-btn is-navy" disabled={busy} aria-busy={busy}>
            {busy ? 'Saving' : saveLabel}
          </button>
          {onCancel && <button type="button" className="rs-btn is-quiet" onClick={onCancel} disabled={busy}>Cancel</button>}
        </div>
      </div>
    </form>
  );
}
