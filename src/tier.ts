// The tier rule (M2 spec §1.1, CHECKLIST F25): phone poses below 883 px wide or 500 px
// tall. It lives outside src/world so the boot entry can use it without pulling in the
// lazy world chunk.
export type Tier = 'desktop' | 'phone';

export const tierFor = (width: number, height: number): Tier => (width < 883 || height < 500 ? 'phone' : 'desktop');
