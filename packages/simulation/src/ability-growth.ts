import type { EquipmentItem } from './equipment';

const milestones: Record<string, { level: number; text: string }[]> = {
  homing: [{ level: 5, text: '转向速度提高至210度/秒' }, { level: 10, text: '转向240度/秒，索敌半径3.5米' }, { level: 15, text: '转向速度提高至270度/秒' }, { level: 20, text: '转向300度/秒，索敌半径4米；耗能与伤害代价保留' }],
  "banner-power": [{"level": 5, "text": "旗阵与军威冲击范围扩大20%"}, {"level": 10, "text": "每8秒入阵可强化下一次直接攻击20%"}, {"level": 15, "text": "持续驻留逐步提高旗帜强度，最多20%"}, {"level": 20, "text": "每6秒军威脉冲强化下一次直接攻击30%，1.5秒内旗阵攻击提高30%"}],
  "banner-tempo": [{"level": 5, "text": "旗帜持续时间增加3秒，延长自动点刺"}, {"level": 10, "text": "持续驻留逐步提高旗帜强度，最多25%"}, {"level": 15, "text": "离阵后基础保留时间增加至2秒"}, {"level": 20, "text": "每6秒进入1.5秒急攻，旗帜强度与点刺伤害提高30%"}],
  "banner-wind": [{"level": 5, "text": "旗阵与风刃覆盖范围扩大20%"}, {"level": 10, "text": "穿过旗阵的己方投射物也能获得飞行加速"}, {"level": 15, "text": "改善已有追踪能力的追星弹转向"}, {"level": 20, "text": "每6秒强化风刃30%，持续1.5秒；旗帜消失后留下2秒衰减风场"}],
  "banner-energy": [{"level": 5, "text": "旗帜持续时间增加3秒，延长内收灵潮"}, {"level": 10, "text": "每8秒入阵可强化下一次心法恢复20%"}, {"level": 15, "text": "灵力低于25%时旗帜强度提高25%"}, {"level": 20, "text": "每6秒归元脉冲强化下一次心法恢复30%，1.5秒内灵潮伤害提高30%"}],
  "banner-guard": [{"level": 5, "text": "旗阵与地脉震击范围扩大20%"}, {"level": 10, "text": "驻留并停止移动时生成5%最大生命护盾，间隔6秒"}, {"level": 15, "text": "阵内护盾破裂后1.5秒强化减伤，追加150%伤害的反击震波"}, {"level": 20, "text": "每6秒进入1.5秒坚守，减伤效果增强50%，震击伤害提高30%"}],
  "duration": [{"level": 5, "text": "延长持续时间的收益提高"}, {"level": 10, "text": "到期增加1秒衰减退场"}, {"level": 15, "text": "持续时间进一步增长"}, {"level": 20, "text": "衰减退场延长至2秒"}],
  "linger": [{"level": 5, "text": "提高离阵保留时间和效果强度"}, {"level": 10, "text": "进一步延长余韵"}, {"level": 15, "text": "离阵增益保留强度继续提高"}, {"level": 20, "text": "余韵额外约3.4秒，保留约80%强度"}],
  "twin": [{"level": 5, "text": "支持两面旗阵分开覆盖队友"}, {"level": 10, "text": "旧旗存在时新旗布置间隔缩短15%"}, {"level": 15, "text": "保持双旗上限，同类不叠加"}, {"level": 20, "text": "旧旗存在时新旗布置间隔缩短25%"}],
  "concentrate": [{"level": 5, "text": "范围进一步缩小，伤害或增益进一步增强"}, {"level": 10, "text": "战旗驻留3秒后强度额外提高10%"}, {"level": 15, "text": "压缩范围与强化收益继续提高"}, {"level": 20, "text": "战旗驻留强化提高至20%"}],

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
    {"level": 5, "text": "连接能力灵力消耗降低8%"},
    {"level": 10, "text": "连接能力灵力消耗降低15%"},
    {"level": 15, "text": "低于25%储量时额外恢复20%，间隔4秒"},
    {"level": 20, "text": "低储量额外恢复提高至40%"}
  ],
  "spring": [
    {"level": 5, "text": "基础恢复间隔缩短10%"},
    {"level": 10, "text": "基础恢复间隔缩短20%"},
    {"level": 15, "text": "持续低储量1秒后急涌2秒，恢复间隔再缩短20%"},
    {"level": 20, "text": "急涌恢复间隔缩短35%"}
  ],
  "ocean": [
    {"level": 5, "text": "容量额外提高12%"},
    {"level": 10, "text": "容量额外提高25%"},
    {"level": 15, "text": "低储量后下一次恢复额外恢复50%，间隔6秒"},
    {"level": 20, "text": "低储量额外恢复提高至80%"}
  ],
  "cycle": [
    {"level": 5, "text": "增加能力槽，近远交替强化下次恢复"},
    {"level": 10, "text": "增加能力槽，交替供能随等级成长"},
    {"level": 15, "text": "每完成3次有效交替，强化2次正常恢复15%"},
    {"level": 20, "text": "强化3次正常恢复30%"}
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
