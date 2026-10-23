import { supabase, type Rev2Client } from '$lib/api/supabaseClient';

export type HexSpiritGalleryTag = {
	id: string;
	name: string;
	color: string;
	position: number;
	created_at: string;
	updated_at: string;
};

export type HexSpiritGalleryTagAssignment = {
	tag_id: string;
	hex_spirit_id: string;
	created_at: string;
};

export async function fetchHexSpiritGalleryTags(
	client: Rev2Client = supabase
): Promise<HexSpiritGalleryTag[]> {
	const { data, error } = await client
		.from('hex_spirit_gallery_tags')
		.select('*')
		.order('position')
		.order('created_at');
	if (error) throw error;
	return (data ?? []) as HexSpiritGalleryTag[];
}

export async function fetchHexSpiritGalleryTagAssignments(
	client: Rev2Client = supabase
): Promise<HexSpiritGalleryTagAssignment[]> {
	const { data, error } = await client
		.from('hex_spirit_gallery_tag_assignments')
		.select('*')
		.order('created_at');
	if (error) throw error;
	return (data ?? []) as HexSpiritGalleryTagAssignment[];
}

export async function createHexSpiritGalleryTag(
	name: string,
	color: string,
	position: number,
	client: Rev2Client = supabase
): Promise<HexSpiritGalleryTag> {
	const { data, error } = await client
		.from('hex_spirit_gallery_tags')
		.insert({ name: name.trim(), color, position })
		.select('*')
		.single();
	if (error) throw error;
	return data as HexSpiritGalleryTag;
}

export async function deleteHexSpiritGalleryTag(
	tagId: string,
	client: Rev2Client = supabase
): Promise<void> {
	const { error } = await client.from('hex_spirit_gallery_tags').delete().eq('id', tagId);
	if (error) throw error;
}

export async function setHexSpiritGalleryTagAssignment(
	tagId: string,
	spiritId: string,
	assigned: boolean,
	client: Rev2Client = supabase
): Promise<void> {
	if (assigned) {
		const { error } = await client
			.from('hex_spirit_gallery_tag_assignments')
			.upsert({ tag_id: tagId, hex_spirit_id: spiritId }, { onConflict: 'tag_id,hex_spirit_id' });
		if (error) throw error;
		return;
	}

	const { error } = await client
		.from('hex_spirit_gallery_tag_assignments')
		.delete()
		.eq('tag_id', tagId)
		.eq('hex_spirit_id', spiritId);
	if (error) throw error;
}
