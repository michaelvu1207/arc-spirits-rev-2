export type FrameRegion = 'Forest' | 'Mountain' | 'Fire' | 'Water' | 'Sun' | 'Moon' | 'Heroes';
export interface RegionalFrameTrait { id: string; name: string; count: number; iconHref?: string | null }
export interface RegionalFrameData { id?: string; name: string; region: FrameRegion; cost: number; artHref?: string; background?: string; traits?: RegionalFrameTrait[]; cursed?: boolean }
export const FRAME_REGIONS: Record<FrameRegion, { dark:string; mid:string; light:string; paper:string; metal:string; motif:string }>;
export function resolveFrame(region: string, cost: number): {region:FrameRegion;cost:number;key:string;palette:typeof FRAME_REGIONS[FrameRegion];weight:number};
export function frameDataFromSpirit(spirit: {id:string;name:string;cost:number;region?:string;art_raw_image_url?:string;traits?:{origin_ids?:string[];class_ids?:string[]}}, options?:{origins?:{id:string;name:string}[];classes?:{id:string;name:string;icon_png?:string|null}[];region?:string;name?:string;artHref?:string;iconUrl?:(path:string)=>string}): RegionalFrameData;
export function renderRegionalHexSvg(data:RegionalFrameData, options?:{size?:number;frameOnly?:boolean}):string;
