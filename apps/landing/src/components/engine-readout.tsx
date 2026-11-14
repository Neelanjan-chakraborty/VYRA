import sample from '@/content/engine-sample.json';

const percent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * Real output of VYRA's compatibility engine for two synthetic profiles
 * (src/content/engine-sample.json, written by scripts/engine-sample.mjs).
 * This is a read-out of data, not a picture of an app screen.
 */
export function EngineReadout({ showScenarios = false }: { readonly showScenarios?: boolean }) {
  return (
    <figure>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b border-line pb-6">
        <div>
          <p className="t-eyebrow text-muted">Estimated alignment</p>
          <p className="font-display text-[clamp(4.5rem,11vw,9.5rem)] leading-[0.85] tracking-[-0.03em]">
            {sample.overall === null ? '—' : Math.round(sample.overall * 100)}
            <span className="text-[0.4em] tracking-normal text-muted"> / 100</span>
          </p>
        </div>
        <dl className="t-small grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-muted">
          <dt>Confidence</dt>
          <dd className="text-fg">{percent(sample.confidence)}</dd>
          <dt>Data</dt>
          <dd className="text-fg">
            {sample.sufficiency === 'SUFFICIENT' ? 'Enough to say' : 'Partial'}
          </dd>
          <dt>Engine</dt>
          <dd className="text-fg">{sample.engineVersion}</dd>
        </dl>
      </div>
      <ol>
        {sample.dimensions
          .toSorted((a, b) => b.weight - a.weight)
          .map((dimension) => {
            const reason = dimension.aligned[0] ?? dimension.different[0];
            return (
              <li
                key={dimension.key}
                className="grid-12 items-baseline gap-y-2 border-b border-line py-5"
              >
                <h3 className="t-title col-span-8 sm:col-span-4">{dimension.title}</h3>
                <p className="t-small col-span-4 text-right text-muted sm:order-last sm:col-span-2">
                  <span className="font-display text-[1.75rem] leading-none text-fg">
                    {dimension.score === null ? '—' : Math.round(dimension.score * 100)}
                  </span>
                  <span className="sr-only"> out of 100, </span>
                  <span className="block">weight {percent(dimension.weight)}</span>
                </p>
                <div className="col-span-12 sm:col-span-6">
                  <div className="h-px w-full bg-line" aria-hidden="true">
                    <div
                      className="bar-fill h-[3px] -translate-y-px bg-accent"
                      style={{ width: percent(dimension.score ?? 0) }}
                    />
                  </div>
                  {reason ? <p className="t-small mt-3 text-muted">{reason}</p> : null}
                  {dimension.coverage < 1 ? (
                    <p className="t-small mt-1 text-muted">
                      Only {percent(dimension.coverage)} of this dimension is known for both people,
                      so it counts for less.
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
      </ol>
      {showScenarios ? (
        <div className="mt-12">
          <h3 className="t-eyebrow text-muted">The same pair, scenario by scenario</h3>
          <ul className="mt-4 grid gap-x-10 sm:grid-cols-2">
            {sample.scenarios.map((scenario) => (
              <li
                key={scenario.key}
                className="flex items-baseline justify-between gap-4 border-b border-line py-3"
              >
                <span>{scenario.title}</span>
                <span className="font-display text-[1.5rem] leading-none">
                  {scenario.alignment === null
                    ? 'Not enough to say'
                    : Math.round(scenario.alignment * 100)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <figcaption className="t-small mt-6 max-w-2xl text-muted">
        Output of VYRA’s compatibility engine ({sample.engineVersion}) for two invented test
        profiles, shown as data. In the app the same result appears in words with its reasons, not
        as numbers. These figures are estimated alignment under weights that are product hypotheses,
        not a prediction of how any relationship will go.
      </figcaption>
    </figure>
  );
}
