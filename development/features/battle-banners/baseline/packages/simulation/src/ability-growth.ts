import type { EquipmentItem } from './equipment';

const milestones: Record<string, { level: number; text: string }[]> = {
  'star-beam': [{ level: 5, text: '射程延长至10米' }, { level: 10, text: '持续命中目标逐渐聚能' }, { level: 15, text: '击杀后可以重新锁定' }, { level: 20, text: '最后一段光束强化贯穿' }],
  'chain-lightning': [{ level: 5, text: '连锁5个目标' }, { level: 10, text: '跳跃范围4米' }, { level: 15, text: '优先连接自身雷印' }, { level: 20, text: '末目标追加衰减回击' }],
  'decay-curse': [{ level: 5, text: '死亡后传播一次' }, { level: 10, text: '最多传播3代' }, { level: 15, text: '成熟感染传播增强' }, { level: 20, text: '末代死亡产生毒爆' }],
  'sword-array': [{ level: 5, text: '剑阵持续8秒' }, { level: 10, text: '同时攻击2个目标' }, { level: 15, text: '优先攻击外围敌人' }, { level: 20, text: '结束前付费收束齐射' }],
  'binding-trap': [{ level: 5, text: '触发半径扩大至2米' }, { level: 10, text: '减速持续2秒' }, { level: 15, text: '同时保留2个陷阵' }, { level: 20, text: '触发后追加衰减爆发' }],

  "slash": [
    {"level": 5, "text": "横扫扩大至150度"},
    {"level": 10, "text": "横扫扩大至180度，覆盖前方半圆"},
    {"level": 15, "text": "连续3次命中后，下一次横扫距离增加0.35米"},
    {"level": 20, "text": "强化横扫变为周身回旋斩"}
  ],
  "dual": [
    {"level": 5, "text": "每第4击释放90度交叉斩，造成125%伤害"},
    {"level": 10, "text": "每第3击释放120度交叉斩，造成150%伤害"},
    {"level": 15, "text": "交叉斩后连击进度可保留6秒"},
    {"level": 20, "text": "交叉斩对主要目标追加一次50%伤害终结斩"}
  ],
  "spear": [
    {"level": 5, "text": "突刺延长至3.3米，宽度0.9米"},
    {"level": 10, "text": "突刺3.6米、宽度1.1米，最远1米伤害提高25%"},
    {"level": 15, "text": "同次贯穿3个目标，枪尖产生35%伤害冲击"},
    {"level": 20, "text": "最远1米命中后，下一次突刺间隔缩短20%"}
  ],
  "hammer": [
    {"level": 5, "text": "每第4击周身震击，击退距离提高50%"},
    {"level": 10, "text": "每第3击周身震击"},
    {"level": 15, "text": "周身震击留下3秒裂地，减速20%"},
    {"level": 20, "text": "下一次周身震击震碎自身旧裂地，追加40%伤害"}
  ],
  "thunder-staff": [
    {"level": 5, "text": "横扫150度，雷爆半径1.5米"},
    {"level": 10, "text": "横扫180度，雷爆半径1.8米"},
    {"level": 15, "text": "同次引爆2个雷印，强化下一次横扫30%"},
    {"level": 20, "text": "强化横扫引爆额外提高20%，不连锁"}
  ],
  "blade": [
    {"level": 5, "text": "风刃可命中3个目标"},
    {"level": 10, "text": "命中4个目标，并以50%伤害沿原路径返回"},
    {"level": 15, "text": "返程可命中6个目标"},
    {"level": 20, "text": "返程追随角色当前位置，走位改变回程路径"}
  ],
  "star": [
    {"level": 5, "text": "命中后弹射1次，伤害减半"},
    {"level": 10, "text": "可弹射2次，每次伤害减半"},
    {"level": 15, "text": "追踪目标死亡后重新寻找附近目标"},
    {"level": 20, "text": "无新弹射目标时，剩余次数转为一次衰减终结命中"}
  ],
  "fireball": [
    {"level": 5, "text": "爆炸留下1.5秒余火，每0.5秒造成15%伤害"},
    {"level": 10, "text": "爆炸半径2米，余火持续3秒"},
    {"level": 15, "text": "命中自己的余火触发35%伤害脉冲，同次限1次"},
    {"level": 20, "text": "脉冲刷新原余火至3秒，同玩家重叠余火取较强伤害"}
  ],
  "frost": [
    {"level": 5, "text": "命中释放1.25米减速冰环"},
    {"level": 10, "text": "减速强化，并对自身寒棘已减速目标追加40%碎冰伤害"},
    {"level": 15, "text": "碎冰后留下2秒冰缓区域"},
    {"level": 20, "text": "同目标每3秒可触发一次80%伤害强化碎冰"}
  ],
  "thunder-seal": [
    {"level": 5, "text": "死亡目标的雷印转移一次，继承剩余时间"},
    {"level": 10, "text": "命中2个目标，雷印持续8秒"},
    {"level": 15, "text": "自身雷印被长棍引爆后保留4秒残印"},
    {"level": 20, "text": "重新命中残印，恢复的雷印引爆伤害提高30%"}
  ],
  "fork": [
    {"level": 3, "text": "分裂子弹射程延长"},
    {"level": 5, "text": "分裂子弹可命中2个目标"},
    {"level": 10, "text": "分裂子弹优先指向附近未命中的目标"},
    {"level": 15, "text": "子弹可命中3个目标"},
    {"level": 20, "text": "分裂为3枚子弹，不能再次分裂"}
  ],
  "unleash": [
    {"level": 3, "text": "每3次施放触发释出"},
    {"level": 5, "text": "释出追加2枚延迟投射物"},
    {"level": 10, "text": "追加弹发射前重新选择合法目标"},
    {"level": 15, "text": "追加弹间隔缩短至0.12秒"},
    {"level": 20, "text": "同组追加弹锁定首枚选定目标，死亡后才切换"}
  ],
  "aftershock": [
    {"level": 3, "text": "余震覆盖范围扩大"},
    {"level": 5, "text": "余震变为向外扩散的冲击环"},
    {"level": 10, "text": "冲击环扩散时间延长至0.75秒"},
    {"level": 15, "text": "最外沿伤害提高25%"},
    {"level": 20, "text": "扩散后收束一次，收束伤害减半，往返各命中一次"}
  ],
  "execution-spread": [
    {"level": 3, "text": "处决传播范围扩大至4米"},
    {"level": 5, "text": "处决可传播至3个目标"},
    {"level": 10, "text": "附近无目标时保留传播机会1.5秒"},
    {"level": 15, "text": "传播目标上限提高至4个"},
    {"level": 20, "text": "传播雷印最低持续2秒，传播状态不连锁"}
  ],
  "multiple": [
    {"level": 3, "text": "每次发射4枚，耗能增加80%"},
    {"level": 5, "text": "每次发射5枚，耗能增加100%"},
    {"level": 10, "text": "两侧投射物射程提高20%"},
    {"level": 15, "text": "两侧投射物伤害提高10%"},
    {"level": 20, "text": "扇形覆盖加宽，最多仍为5枚"}
  ],
  "economy": [
    {"level": 3, "text": "缺能等待0.5秒后，下次消耗额外降低10%"},
    {"level": 5, "text": "每4次施放积累节能，低于半池时消耗蓄积"},
    {"level": 10, "text": "可储存2次节能蓄积"},
    {"level": 15, "text": "每3次施放积累节能"},
    {"level": 20, "text": "节能额外折扣提高至20%，与等待折扣取较强者"}
  ],
  "overload": [
    {"level": 3, "text": "每4次施放后准备过载攻击，额外增伤20%"},
    {"level": 5, "text": "积累要求降低至3次"},
    {"level": 10, "text": "过载攻击首次直接命中额外增伤25%"},
    {"level": 15, "text": "过载落空时保留资格6秒"},
    {"level": 20, "text": "每2次施放准备一次过载"}
  ],
  "haste": [
    {"level": 3, "text": "连续施放积累加速，每层4%，最多3层"},
    {"level": 5, "text": "加速可积累5层"},
    {"level": 10, "text": "停止施放后保留加速2秒"},
    {"level": 15, "text": "缺能等待时保留加速4秒"},
    {"level": 20, "text": "满层每第5次施放后，下一次间隔减半"}
  ],
  "area": [
    {"level": 3, "text": "进一步扩展原攻击覆盖"},
    {"level": 5, "text": "增加40%伤害外沿，不与中心重复命中"},
    {"level": 10, "text": "外沿宽度由20%提高至30%"},
    {"level": 15, "text": "外沿伤害提高至65%"},
    {"level": 20, "text": "外沿保留0.3秒，可命中新进入的目标"}
  ],
  "knockback": [
    {"level": 3, "text": "推离距离随等级提高"},
    {"level": 5, "text": "撞墙追加30%碰撞伤害"},
    {"level": 10, "text": "碰撞影响附近0.75米敌人"},
    {"level": 15, "text": "碰撞后减速25%，持续1秒"},
    {"level": 20, "text": "碰撞伤害45%，半径1.2米，不形成击退链"}
  ],
  "resonance": [
    {"level": 3, "text": "共鸣等待时间延长至6秒"},
    {"level": 5, "text": "消耗共鸣积累接力，进度保留6秒"},
    {"level": 10, "text": "完成3次接力，下一次共鸣增幅提高50%"},
    {"level": 15, "text": "接力进度保留10秒"},
    {"level": 20, "text": "强化共鸣同时使接收攻击消耗降低20%"}
  ],
  "stream": [
    {"level": 5, "text": "恢复魔法成本降低8%"},
    {"level": 10, "text": "恢复魔法成本降低15%"},
    {"level": 15, "text": "低于25%储量时额外转换20%，间隔4秒，正常付费"},
    {"level": 20, "text": "低储量额外转换提高至40%"}
  ],
  "spring": [
    {"level": 5, "text": "基础恢复间隔缩短10%"},
    {"level": 10, "text": "基础恢复间隔缩短20%"},
    {"level": 15, "text": "持续低储量1秒后急涌2秒，恢复间隔再缩短20%"},
    {"level": 20, "text": "急涌恢复间隔缩短35%，正常按转换量付费"}
  ],
  "ocean": [
    {"level": 5, "text": "容量额外提高12%"},
    {"level": 10, "text": "容量额外提高25%"},
    {"level": 15, "text": "低储量后下一次恢复额外转换50%，间隔6秒"},
    {"level": 20, "text": "低储量额外转换提高至80%，正常付费"}
  ],
  "cycle": [
    {"level": 5, "text": "增加能力槽，近远交替强化下次恢复"},
    {"level": 10, "text": "增加能力槽，交替供能随等级成长"},
    {"level": 15, "text": "每完成3次有效交替，强化2次正常恢复15%"},
    {"level": 20, "text": "强化3次正常恢复30%，正常付费"}
  ]
};
function growthKey(item: EquipmentItem): string { const id = item.definitionId ?? item.id; const parts = id.split('/'); return item.effect ?? parts[parts.length - 1]; }
export function abilityUnlock(item: EquipmentItem, level: number): string {
  const key = growthKey(item); return milestones[key]?.find(entry => entry.level === level)?.text ?? '';
}
export function abilityGrowthRoute(item: EquipmentItem): string[] {
  const key = growthKey(item); return (milestones[key] ?? []).map(entry => `Lv.${entry.level}：${entry.text}`);
}
export function abilityGrowthSummary(item: EquipmentItem): string {
  const key = growthKey(item); const entries = milestones[key] ?? []; const level = item.level ?? 1;
  const unlocked = entries.filter(entry => entry.level <= level); const current = unlocked.at(-1); const next = entries.find(entry => entry.level > level);
  return [current ? `已解锁：${current.text}` : '', next ? `下阶段 Lv.${next.level}：${next.text}` : ''].filter(Boolean).join('；');
}
