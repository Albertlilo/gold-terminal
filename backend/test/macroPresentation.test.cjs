const test = require('node:test');
const assert = require('node:assert/strict');
const { macroPresentation, cleanObservations } = require('../src/services/macroPresentation');
const points = (...rows) => rows.map(([date, value]) => ({ date, value }));
test('NFP uses monthly thousands and ADP converts persons to thousands', () => {
  const nfp = macroPresentation('PAYEMS', points(['2026-09-01',159044], ['2026-08-01',159015], ['2026-07-01',158882]), 'checked');
  assert.equal(nfp.value,29); assert.equal(nfp.previousValue,133); assert.equal(nfp.checkedAt,'checked');
  assert.equal(macroPresentation('ADPMNUSNERSA', points(['2026-09-01',132889000],['2026-08-01',132850000])).value,39);
});
test('policy target bounds remain separate from the effective federal funds rate', () => {
  const lower = macroPresentation('DFEDTARL', points(['2026-10-29', 3.75], ['2026-09-18', 4]), 'checked');
  const upper = macroPresentation('DFEDTARU', points(['2026-10-29', 4], ['2026-09-18', 4.25]), 'checked');
  const effective = macroPresentation('DFF', points(['2026-10-29', 3.88], ['2026-10-28', 3.87]), 'checked');
  assert.equal(lower.value, 3.75);
  assert.equal(upper.value, 4);
  assert.equal(effective.value, 3.88);
  assert.equal(lower.previousDate, '2026-09-18');
  assert.equal(effective.officialReleaseAt, null);
});
test('ADP reports monthly private payroll change and change in that monthly pace', () => {
  const adp = macroPresentation('ADPMNUSNERSA', points(
    ['2026-10-01', 132975000], ['2026-09-01', 132889000], ['2026-08-01', 132803000]
  ));
  assert.equal(adp.value, 86);
  assert.equal(adp.previousValue, 86);
  assert.equal(adp.changeFromPrevious, 0);
  assert.match(adp.description, /private-sector/);
});
test('average hourly earnings show month-on-month wage growth without a fabricated release time', () => {
  const wages = macroPresentation('CES0500000003', points(['2026-10-01', 37.5], ['2026-09-01', 37.35]));
  assert.ok(Math.abs(wages.value - ((37.5 / 37.35 - 1) * 100)) < 1e-10);
  assert.equal(wages.unit, '% MoM');
  assert.equal(wages.officialReleaseAt, null);
});
test('annual inflation matches calendar periods and rejects missing or zero bases', () => {
  const data = points(['2026-08-01',103],['2026-07-01',102],['2025-08-01',100],['2025-07-01',100]);
  const result = macroPresentation('PCEPILFE',data);
  assert.ok(Math.abs(result.value-3)<1e-10); assert.ok(Math.abs(result.previousValue-2)<1e-10);
  assert.equal(macroPresentation('PCEPILFE',points(['2026-08-01',103],['2025-07-01',100])).value,null);
  assert.equal(macroPresentation('PCEPILFE',points(['2026-08-01',103],['2025-08-01',0])).value,null);
});
test('growth is monthly or annualized quarterly, never an index labelled percent', () => {
  const monthly = macroPresentation('RSAFS',points(['2026-08-01',101],['2026-07-01',100]));
  assert.ok(Math.abs(monthly.value-1)<1e-10);
  const quarterly = macroPresentation('GDPC1',points(['2026-04-01',101],['2026-01-01',100]));
  assert.ok(Math.abs(quarterly.value-4.060401)<1e-8);
  assert.equal(macroPresentation('PAYEMS',points(['2026-09-01',159044],['2026-07-01',158882])).value,null);
});
test('balances, claims, rates and indices preserve their economic units', () => {
  for (const [id, input, expected, unit] of [['WTREGEN',948674,948.674,'USD billion'],['M2SL',23342.8,23.3428,'USD trillion'],['ICSA',197000,197,'K claims'],['VIXCLS',16.39,16.39,'index'],['UNRATE',4.2,4.2,'%']]) {
    const result = macroPresentation(id,points(['2026-09-01',input]));
    assert.ok(Math.abs(result.value-expected)<1e-9); assert.equal(result.unit,unit);
  }
});
test('invalid observations cannot become zero or distort ordering', () => {
  assert.deepEqual(cleanObservations(points(['2026-01-01','2'],['2026-02-01','.'],['2026-03-01',''],['2026-04-01',null],['2026-05-01','Infinity'],['2026-06-01','3'])), points(['2026-06-01',3],['2026-01-01',2]));
});
