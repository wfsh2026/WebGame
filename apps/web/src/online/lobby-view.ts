import type { TestAssetsData, TestAssetAdjustmentData } from '@web-game-world/contracts';
import type { InventoryItemData } from '@web-game-world/contracts';
import type { FormEvent, ReactNode } from 'react';
import type { Snapshot } from '@web-game-world/contracts';
import type { EquipmentLoadoutData, EquipmentStateData, Profile, ShopStateData, ShopPurchaseData, ShopRefreshData } from '@web-game-world/contracts';

export interface BackpackViewProps {
  mode: 'lobby' | 'battle';
  loadInventory: () => Promise<InventoryItemData[]>;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
}
export interface LobbyViewProps {
  addTestInventory?: (requestId: string) => Promise<number>;
  loadTestAssets?: () => Promise<TestAssetsData>;
  adjustTestAssets?: (data: TestAssetAdjustmentData) => Promise<TestAssetsData>;
  renderBackpack?: (props: BackpackViewProps) => ReactNode;
  loadInventory?: () => Promise<InventoryItemData[]>;
  loadShop?: () => Promise<ShopStateData>;
  purchaseProduct?: (data: ShopPurchaseData) => Promise<ShopStateData>;
  refreshShop?: (data: ShopRefreshData) => Promise<ShopStateData>;
  loadEquipment?: () => Promise<EquipmentStateData>;
  saveEquipment?: (data: { loadout: EquipmentLoadoutData; revision: number }) => Promise<EquipmentStateData>;
  profile: Profile;
  rooms: { roomId: string; clients: number; maxClients: number; name: string }[];
  history: { runId: string; settled: boolean; coins: number; materials: number; run: { status: string; createdAt: string } }[];
  busy: boolean;
  error: string;
  enterRoom: (id?: string) => Promise<void>;
  logout: () => Promise<void>;
}
export interface AuthViewProps {
  name: string;
  password: string;
  login: boolean;
  busy: boolean;
  restoring: boolean;
  error: string;
  changeName: (name: string) => void;
  changePassword: (password: string) => void;
  changeMode: () => void;
  authenticate: (event: FormEvent) => Promise<void>;
}
export interface OnlineAppProps {
  renderParty?: (props: PartyViewProps) => ReactNode;
  renderBackpack?: (props: BackpackViewProps) => ReactNode;
  renderLobby?: (props: LobbyViewProps) => ReactNode;
  renderAuth?: (props: AuthViewProps) => ReactNode;
}

export interface PartyViewProps {
  snapshot: Snapshot;
  playerId: string;
  busy: boolean;
  connection: string;
  error: string;
  ready: () => void;
  start: () => void;
  leave: () => Promise<void>;
}
