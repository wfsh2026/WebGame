export type RoleId = 'ranger' | 'guardian' | 'mage';
export type RiftId = 'forest' | 'sand' | 'tide';

export interface Role {
  id: RoleId;
  name: string;
  title: string;
  description: string;
  symbol: string;
  stats: string[];
}

export const roles: Role[] = [
  { id: 'ranger', name: '逐风者', title: '灵巧 · 远程', description: '穿过林间的风，总能找到前行的方向。', symbol: '↗', stats: ['灵巧 85', '生存 65', '探索 90'] },
  { id: 'guardian', name: '守望者', title: '坚韧 · 近战', description: '以盾为约，成为同行者最可靠的后盾。', symbol: '◇', stats: ['灵巧 55', '生存 95', '探索 70'] },
  { id: 'mage', name: '织星者', title: '奥术 · 范围', description: '收集散落的星光，让未知化为力量。', symbol: '✧', stats: ['灵巧 70', '生存 60', '探索 95'] },
];

export interface Rift {
  id: RiftId;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  type: string;
  difficulty: string;
  color: string;
  rounds: string[];
}

// 本文件仅描述本地界面演示，不是正式内容配置、奖励表或多人规则。
export const rifts: Rift[] = [
  { id: 'forest', number: '01', title: '森语遗迹', subtitle: 'WHISPERING WOODS', description: '古老的石门再次苏醒。沿着萤光，寻找森林深处的秘密。', type: '探索', difficulty: '初阶', color: 'green', rounds: ['萤火小径', '古树回廊', '遗迹之心'] },
  { id: 'sand', number: '02', title: '落日沙海', subtitle: 'SUNSET DUNES', description: '穿越沉睡的沙丘，在暮色降临之前，找回失落的碎片。', type: '收集', difficulty: '进阶', color: 'orange', rounds: ['流沙边境', '无声绿洲', '落日神殿'] },
  { id: 'tide', number: '03', title: '潮汐之境', subtitle: 'TIDAL SANCTUARY', description: '循着远方的潮声，探索被海水遗忘的群岛与星光。', type: '探索', difficulty: '进阶', color: 'blue', rounds: ['浅滩来信', '浮岛星屿', '潮声回响'] },
];

export const companions = ['青苔', '晚风', '拾光'];
export const restDuration = 18;
export const collectionTarget = 5;
export const finalCoins = 360;
export const finalMaterials = 6;

export function getRift(id: RiftId): Rift {
  const selected = rifts.find((rift) => rift.id === id);
  return selected ?? rifts[0];
}

export function getRole(id: RoleId): Role {
  const selected = roles.find((role) => role.id === id);
  return selected ?? roles[0];
}
