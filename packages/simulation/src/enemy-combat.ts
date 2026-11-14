import type { Enemy, Simulation, Vec } from './index';
import type { EnemyActions } from './enemy-tactics';
import { beginEnemyCycle, canBeginEnemyAttack, enemyAbilities, enemyRank, enemyShotAngles, enemyTarget, faceEnemy } from './enemy-abilities';
import { queueEnemyHazard } from './enemy-hazards';
import { approachEnemy, retreatEnemy } from './enemy-movement';

export function enemyCombatArea(enemy: Enemy): { x: number; y: number; radius: number; length: number; width: number } {
  const behavior = enemy.definition.behavior ?? (enemy.kind === 'swift' ? 'wolf' : enemy.kind === 'elite' ? 'hammer' : 'tree');
  const extra = enemy.radius - .48;
  const ability = enemyAbilities(enemy);
  const radius = behavior === 'bomb' ? enemy.definition.reach : behavior === 'hammer' ? 1.25 : enemy.radius + enemy.definition.reach;
  const length = behavior === 'wolf' ? 4.5 : behavior === 'shield' ? 1.8 : enemy.definition.reach;
  const growth = behavior === 'wolf' || behavior === 'shield' ? ability.tier * .2 : 0;
  const extension = growth + (behavior === 'wolf' && ability.mode === 'long' ? 1.2 : 0);
  return { x: enemy.attackX ?? enemy.x, y: enemy.attackY ?? enemy.y, radius, length: length + extra + extension, width: enemy.radius * 2 + .25 };
}

function prepareAttack(enemy: Enemy, target: Vec): void {
  const ability = enemyAbilities(enemy);
  const behavior = enemy.definition.behavior;
  const varied = (behavior === 'wolf' || behavior === 'shield' || behavior === 'hammer') && ability.tier > 0 && ability.step > 0;
  const side = (ability.cycle + ability.phase) % 2 === 0 ? 1 : -1;
  const offsetX = varied ? -enemy.facingY * side * ability.tier * .3 : 0;
  const offsetY = varied ? enemy.facingX * side * ability.tier * .3 : 0;
  const aim = { x: target.x + offsetX, y: target.y + offsetY }; faceEnemy(enemy, aim);
  enemy.state = enemy.definition.behavior === 'bomb' && enemy.definition.rank !== 'boss' ? 'detonating' : 'windup';
  ability.windup = enemy.definition.windup;
  if (enemy.definition.behavior === 'archer' && ability.mode === 'sequence') ability.windup = .8;
  enemy.timer = ability.windup; enemy.originX = enemy.x; enemy.originY = enemy.y;
  enemy.attackCount = (enemy.attackCount ?? 0) + 1; enemy.hitIds = [];
  const dx = aim.x - enemy.x; const dy = aim.y - enemy.y; const separation = Math.hypot(dx, dy);
  const offset = Math.min(separation, enemy.definition.reach);
  enemy.attackX = enemy.x + enemy.facingX * offset; enemy.attackY = enemy.y + enemy.facingY * offset;
}

export function scatterEnemyBombs(sim: Simulation, enemy: Enemy): void {
  const rank = enemyRank(enemy); if (rank === 0) return;
  const ability = enemyAbilities(enemy); const count = ability.tier >= 2 || ability.phase > 0 ? 4 : 3;
  const base = Math.atan2(enemy.facingY, enemy.facingX) + ability.cycle * .4;
  for (let index = 0; index < count; index += 1) {
    const angle = base + index * Math.PI * 2 / count; const dx = Math.cos(angle); const dy = Math.sin(angle);
    const plan = { kind: 'blast' as const, x: enemy.x + dx * 3.2, y: enemy.y + dy * 3.2, radius: 1.1, delay: 1.6 + index * .45, persistent: true };
    queueEnemyHazard(sim, enemy, plan);
  }
}

function roots(sim: Simulation, enemy: Enemy): void {
  const rank = enemyRank(enemy); const ability = enemyAbilities(enemy);
  if (rank === 0 && ability.tier === 0) return;
  const angle = Math.atan2(enemy.facingY, enemy.facingX);
  const lanes = rank === 2 ? [-.85, 0, .85] : [0];
  const segments = ability.tier >= 2 ? 3 : 2;
  for (const [lane, offset] of lanes.entries()) {
    for (let segment = 0; segment < (rank === 0 ? 1 : segments); segment += 1) {
      const direction = angle + offset; const dx = Math.cos(direction); const dy = Math.sin(direction);
      const along = enemy.radius + 1.3 + segment * 1.35;
      const order = ability.phase > 0 && ability.cycle % 2 === 0 ? lanes.length - lane - 1 : lane;
      const plan = { kind: 'root' as const, x: enemy.x + dx * along, y: enemy.y + dy * along, radius: .75, length: 1.25, width: .55, angle: direction, delay: 1.1 + order * .45 + segment * .45 };
      queueEnemyHazard(sim, enemy, plan);
    }
  }
}

function fire(sim: Simulation, enemy: Enemy): void {
  const angles = enemyShotAngles(enemy); const ability = enemyAbilities(enemy);
  const hostile = sim.projectiles.filter(shot => shot.hostile);
  if (hostile.length + angles.length > 96) return;
  const speed = 8 + Math.min(1, ability.tier * .35);
  for (const [index, angle] of angles.entries()) {
    const dx = Math.cos(angle); const dy = Math.sin(angle);
    const shot = { id: `${enemy.id}-arrow-${enemy.attackCount}-${index}`, owner: enemy.id, hostile: true, x: enemy.x + dx * enemy.radius, y: enemy.y + dy * enemy.radius, vx: dx * speed, vy: dy * speed, ttl: enemy.definition.reach / speed, damage: enemy.definition.damage };
    sim.projectiles.push(shot);
  }
}

function executeAttack(sim: Simulation, enemy: Enemy, actions: EnemyActions): void {
  const behavior = enemy.definition.behavior; const area = enemyCombatArea(enemy); const ability = enemyAbilities(enemy); const rank = enemyRank(enemy);
  if (behavior === 'wolf' || behavior === 'shield') {
    const speed = behavior === 'wolf' ? 10 : 6;
    enemy.state = 'charge'; enemy.timer = area.length / speed; return;
  }
  if (behavior === 'archer') fire(sim, enemy);
  else if (behavior === 'bomb') {
    scatterEnemyBombs(sim, enemy);
    const plan = { kind: 'blast' as const, x: area.x, y: area.y, radius: 1.4, delay: 1.6 };
    queueEnemyHazard(sim, enemy, plan);
  } else {
    const center = behavior === 'hammer' ? area : enemy;
    for (const player of sim.players) {
      if (player.hp <= 0) continue;
      const dx = player.x - center.x; const dy = player.y - center.y; const separation = Math.hypot(dx, dy);
      const ax = player.x - enemy.x; const ay = player.y - enemy.y; const length = Math.hypot(ax, ay);
      const inSector = behavior === 'hammer' || length < .001 || (ax * enemy.facingX + ay * enemy.facingY) / length >= .5;
      if (separation <= area.radius + .4 && inSector) { const hit = { source: enemy, damage: enemy.definition.damage }; actions.hurt(sim, player, hit); }
    }
    if (behavior === 'tree') roots(sim, enemy);
    if (behavior === 'hammer' && rank === 0 && ability.tier > 0) {
      const plan = { kind: 'blast' as const, x: area.x + enemy.facingX * 1.5, y: area.y + enemy.facingY * 1.5, radius: .65, delay: 1.4 };
      queueEnemyHazard(sim, enemy, plan);
    }
    if (behavior === 'hammer' && rank > 0 && (rank === 1 || ability.step >= (ability.phase > 0 ? 2 : 1))) {
      const plan = { kind: 'ring' as const, x: area.x, y: area.y, radius: area.radius + 2.1, innerRadius: area.radius + .6, delay: 1.5 };
      queueEnemyHazard(sim, enemy, plan);
    }
  }
  const kind = behavior === 'hammer' ? 'enemy-smash' : behavior === 'archer' || behavior === 'bomb' ? 'enemy-shot' : 'enemy-sweep';
  const point = behavior === 'hammer' ? area : enemy;
  const effect = { id: `${enemy.id}-attack-${enemy.attackCount}`, x: point.x, y: point.y, radius: area.radius, kind, duration: .55, facingX: enemy.facingX, facingY: enemy.facingY };
  actions.effect(sim, effect);
  enemy.state = 'recovery'; enemy.timer = enemy.definition.recovery;
  if (behavior === 'archer' && rank > 0) enemy.timer = .55;
  if (behavior === 'tree' && rank > 0) enemy.timer = rank === 2 ? 3.2 : 2;
}

function charge(sim: Simulation, enemy: Enemy, context: { dt: number; actions: EnemyActions }): void {
  const area = enemyCombatArea(enemy); const speed = enemy.definition.behavior === 'wolf' ? 10 : 6;
  const duration = Math.min(context.dt, enemy.timer); const from = { x: enemy.x, y: enemy.y };
  const slices = Math.ceil(speed * duration / .12);
  let blocked = false;
  for (let index = 0; index < slices; index += 1) {
    const movement = { x: enemy.facingX * speed * duration / slices, y: enemy.facingY * speed * duration / slices, radius: enemy.radius };
    const before = { x: enemy.x, y: enemy.y }; context.actions.move(sim, enemy, movement);
    const movedX = enemy.x - before.x; const movedY = enemy.y - before.y;
    const remaining = Math.hypot(movement.x - movedX, movement.y - movedY);
    if (remaining > .001) { blocked = true; break; }
  }
  const dx = enemy.x - from.x; const dy = enemy.y - from.y; const squared = dx * dx + dy * dy;
  enemy.hitIds ??= [];
  for (const player of sim.players) {
    if (player.hp <= 0 || enemy.hitIds.includes(player.id)) continue;
    const ratio = squared === 0 ? 0 : ((player.x - from.x) * dx + (player.y - from.y) * dy) / squared;
    const bounded = Math.min(1, ratio); const t = Math.max(0, bounded);
    const x = player.x - from.x - dx * t; const y = player.y - from.y - dy * t; const separation = Math.hypot(x, y);
    if (separation <= area.width / 2 + .4) {
      enemy.hitIds.push(player.id);
      const source = { x: player.x - enemy.facingX, y: player.y - enemy.facingY }; const hit = { source, damage: enemy.definition.damage };
      context.actions.hurt(sim, player, hit);
    }
  }
  enemy.timer -= context.dt;
  if (enemy.timer > 0 && !blocked) return;
  const kind = enemy.definition.behavior === 'wolf' ? 'enemy-claw' : 'enemy-shield';
  const effect = { id: `${enemy.id}-end-${enemy.attackCount}`, x: enemy.x, y: enemy.y, radius: enemy.radius, kind, duration: .55, facingX: enemy.facingX, facingY: enemy.facingY };
  context.actions.effect(sim, effect); enemy.state = 'recovery'; enemy.timer = enemy.definition.recovery;
}

function continueCombo(enemy: Enemy): boolean {
  const rank = enemyRank(enemy); const ability = enemyAbilities(enemy); const behavior = enemy.definition.behavior;
  let limit = 0;
  if (behavior === 'wolf') limit = rank === 2 ? 1 + ability.phase : rank;
  if (behavior === 'wolf' && ability.mode === 'long') limit = 0;
  if (behavior === 'shield' && rank === 2) limit = 1;
  if (behavior === 'hammer' && rank === 2) limit = 1 + ability.phase;
  if (behavior === 'archer' && rank > 0) limit = ability.mode === 'sequence' ? 2 + ability.phase : 1;
  if (ability.step >= limit) return false;
  ability.step += 1; return true;
}

export function stepEnemyCombat(sim: Simulation, enemy: Enemy, context: { dt: number; actions: EnemyActions }): void {
  const ability = enemyAbilities(enemy); const rank = enemyRank(enemy); const behavior = enemy.definition.behavior;
  if (enemy.state === 'detonating') {
    enemy.timer -= context.dt;
    if (enemy.timer <= 0) { scatterEnemyBombs(sim, enemy); context.actions.detonate(sim, enemy); }
    return;
  }
  if (enemy.state === 'windup') { enemy.timer -= context.dt; if (enemy.timer <= 0) executeAttack(sim, enemy, context.actions); return; }
  if (enemy.state === 'charge') { charge(sim, enemy, context); return; }
  const target = enemyTarget(sim, enemy); if (!target) { enemy.state = 'seek'; return; }
  if (enemy.state === 'recovery') {
    enemy.timer -= context.dt; if (enemy.timer > 0) return;
    const combo = continueCombo(enemy);
    if (combo) {
      const aim = behavior === 'archer' ? { x: enemy.x + enemy.facingX * 5, y: enemy.y + enemy.facingY * 5 } : target;
      prepareAttack(enemy, aim); return;
    }
    enemy.state = 'rest'; enemy.timer = rank === 2 ? 2 : rank === 1 ? 1 : .15; return;
  }
  if (enemy.state === 'rest') {
    enemy.timer -= context.dt; if (enemy.timer > 0) return;
    if (behavior === 'archer' || (behavior === 'wolf' && rank === 2)) { enemy.state = 'retreat'; enemy.timer = .7; return; }
    if (behavior === 'shield' && rank > 0) {
      const oldX = enemy.facingX; const side = ability.cycle % 2 === 0 ? 1 : -1;
      enemy.facingX = -enemy.facingY * side; enemy.facingY = oldX * side;
      enemy.state = 'turn'; enemy.timer = .9; return;
    }
    enemy.state = 'chase';
  }
  if (enemy.state === 'turn') { enemy.timer -= context.dt; if (enemy.timer <= 0) enemy.state = 'chase'; return; }
  if (enemy.state === 'retreat') {
    const flank = behavior === 'wolf';
    const movement = { ...context, target, flank }; const moved = retreatEnemy(sim, enemy, movement);
    enemy.timer -= context.dt;
    if (enemy.timer <= 0 || !moved) enemy.state = 'chase'; return;
  }
  const dx = target.x - enemy.x; const dy = target.y - enemy.y; const separation = Math.hypot(dx, dy);
  if (behavior === 'shield') {
    const angle = Math.atan2(enemy.facingY, enemy.facingX); const desired = Math.atan2(dy, dx) - angle;
    const sine = Math.sin(desired); const cosine = Math.cos(desired); const difference = Math.atan2(sine, cosine);
    const bounded = Math.min(context.dt * 1.2, difference); const turn = Math.max(-context.dt * 1.2, bounded);
    enemy.facingX = Math.cos(angle + turn); enemy.facingY = Math.sin(angle + turn);
  } else faceEnemy(enemy, target);
  const area = enemyCombatArea(enemy);
  const trigger = behavior === 'wolf' ? area.length : behavior === 'shield' ? area.length + .4 : behavior === 'bomb' ? (rank === 2 ? 5 : 1.8 + enemy.radius - .48) : enemy.definition.reach + enemy.radius + .4;
  const aligned = behavior !== 'shield' || separation < .001 || (dx * enemy.facingX + dy * enemy.facingY) / separation > .93;
  const allowed = canBeginEnemyAttack(sim, enemy);
  if (separation <= trigger && aligned && allowed) {
    beginEnemyCycle(enemy); ability.mode = '';
    if (rank === 2 && behavior === 'archer' && ability.cycle % 2 === 0) ability.mode = 'sequence';
    if (rank === 2 && behavior === 'wolf' && ability.cycle % 2 === 1) ability.mode = 'long';
    prepareAttack(enemy, target); return;
  }
  enemy.state = 'chase';
  if (behavior === 'archer' && separation <= enemy.definition.reach) return;
  const movement = { ...context, target }; approachEnemy(sim, enemy, movement);
}
