#!/usr/bin/env python3
"""
Generate a hex spirit token OBJ file for Arc Spirits.

Hex token specs:
- Width: 2.54, Height: 2.2, Thickness: 0.1
- Flat-top hexagon (wider than tall)
- Y-up coordinate system
- Top face UVs map to left half of texture (center U=0.25, V=0.5)
- Bottom face UVs map to right half of texture (center U=0.75, V=0.5), X-mirrored
- Side faces use a thin UV strip at the bottom of the texture
"""

import math
import os

# Dimensions (flat-top: width > height)
WIDTH = 2.54
HEIGHT = 2.2
THICKNESS = 0.1
HALF_THICKNESS = THICKNESS / 2.0

# Flat-top hexagon: first vertex at top-right, flat edge at top and bottom.
# For a unit flat-top hex: width = 2 * circumradius, height = sqrt(3) * circumradius
# Scale factors from unit hex:
#   x_scale = WIDTH / 2.0
#   z_scale = HEIGHT / sqrt(3)

NUM_SIDES = 6

def hex_corner(i):
    """Return (x, z) for the i-th corner of a flat-top hexagon, scaled to WIDTH x HEIGHT."""
    # Flat-top: first vertex at 60 degrees (top-right), going clockwise
    angle_deg = 60 - 60 * i
    angle_rad = math.radians(angle_deg)
    # Unit flat-top hex: width = 2, height = sqrt(3)
    x = math.cos(angle_rad) * (WIDTH / 2.0)
    z = math.sin(angle_rad) * (HEIGHT / math.sqrt(3))
    return (x, z)


def generate_obj():
    vertices = []   # (x, y, z)
    uvs = []        # (u, v)
    normals = []    # (nx, ny, nz)
    faces = []      # list of (v_idx, vt_idx, vn_idx) tuples per face

    # --- Compute hex corners ---
    corners = [hex_corner(i) for i in range(NUM_SIDES)]

    # --- Vertices ---
    # Top ring: vertices 1-6 (index 0-5), y = +HALF_THICKNESS
    for i in range(NUM_SIDES):
        x, z = corners[i]
        vertices.append((x, HALF_THICKNESS, z))

    # Bottom ring: vertices 7-12 (index 6-11), y = -HALF_THICKNESS
    for i in range(NUM_SIDES):
        x, z = corners[i]
        vertices.append((x, -HALF_THICKNESS, z))

    # Top center: vertex 13 (index 12)
    vertices.append((0.0, HALF_THICKNESS, 0.0))

    # Bottom center: vertex 14 (index 13)
    vertices.append((0.0, -HALF_THICKNESS, 0.0))

    # --- Normals ---
    # 0: top face normal (Y+)
    normals.append((0.0, 1.0, 0.0))
    # 1: bottom face normal (Y-)
    normals.append((0.0, -1.0, 0.0))

    # Side normals (one per side edge, 6 total) - indices 2..7
    for i in range(NUM_SIDES):
        x0, z0 = corners[i]
        x1, z1 = corners[(i + 1) % NUM_SIDES]
        # Midpoint direction = outward normal for this side
        mx = (x0 + x1) / 2.0
        mz = (z0 + z1) / 2.0
        length = math.sqrt(mx * mx + mz * mz)
        if length > 0:
            normals.append((mx / length, 0.0, mz / length))
        else:
            normals.append((1.0, 0.0, 0.0))

    # --- UVs ---
    # Top face UVs: map hex to left half of texture, center at (0.25, 0.5)
    # The hex corners in UV space should preserve the hex shape proportionally.
    # We'll map the hex to fit within [0, 0.5] x [0, 1] (left half).
    # UV center = (0.25, 0.5)
    # Scale: the hex should fit nicely in the left half.
    # Max extent in X (half-width) maps to 0.25, max extent in Z (half-height) maps to 0.5
    # So uv_x = 0.25 + (x / (WIDTH/2)) * 0.25 = 0.25 + x * (0.5 / WIDTH)
    #    uv_y = 0.5 + (z / (HEIGHT/2)) * 0.5 = 0.5 + z * (1.0 / HEIGHT)

    # Top face center UV (index 0)
    uv_top_center_idx = len(uvs)
    uvs.append((0.25, 0.5))

    # Top face corner UVs (indices 1-6)
    uv_top_corners_start = len(uvs)
    for i in range(NUM_SIDES):
        x, z = corners[i]
        u = 0.25 + x * (0.5 / WIDTH)
        v = 0.5 + z * (1.0 / HEIGHT)
        uvs.append((u, v))

    # Bottom face UVs: map hex to right half of texture, center at (0.75, 0.5)
    # X-mirrored so that when viewed from below, the image reads correctly.
    # Mirror means: flip the X component relative to center.
    # Bottom face: X-mirrored so image reads correctly when viewed from below
    # uv_x = 0.75 - x * (0.5 / WIDTH)

    # Bottom face center UV
    uv_bot_center_idx = len(uvs)
    uvs.append((0.75, 0.5))

    # Bottom face corner UVs
    uv_bot_corners_start = len(uvs)
    for i in range(NUM_SIDES):
        x, z = corners[i]
        u = 0.75 - x * (0.5 / WIDTH)
        v = 0.5 + z * (1.0 / HEIGHT)
        uvs.append((u, v))

    # Side face UVs: thin strip at bottom of texture
    # We'll use a strip from v=0.0 to v=0.05 across the full u range [0, 1]
    # Each side quad gets a proportional slice of u based on edge length.
    SIDE_V_BOTTOM = 0.0
    SIDE_V_TOP = 0.05

    # Compute total perimeter for proportional UV distribution
    edge_lengths = []
    for i in range(NUM_SIDES):
        x0, z0 = corners[i]
        x1, z1 = corners[(i + 1) % NUM_SIDES]
        edge_lengths.append(math.sqrt((x1 - x0) ** 2 + (z1 - z0) ** 2))
    total_perimeter = sum(edge_lengths)

    # Generate side UVs - we need u positions at each corner boundary
    side_uv_start = len(uvs)
    u_pos = 0.0
    side_u_positions = [0.0]
    for i in range(NUM_SIDES):
        u_pos += edge_lengths[i] / total_perimeter
        side_u_positions.append(u_pos)

    # For each side quad, we need 4 UV coords (bottom-left, bottom-right, top-right, top-left)
    # But we can share UVs at seam points. Let's create per-side UVs for simplicity.
    side_uv_indices = []  # list of (bl, br, tr, tl) UV indices per side
    for i in range(NUM_SIDES):
        u_left = side_u_positions[i]
        u_right = side_u_positions[i + 1]
        bl = len(uvs)
        uvs.append((u_left, SIDE_V_BOTTOM))
        br = len(uvs)
        uvs.append((u_right, SIDE_V_BOTTOM))
        tr = len(uvs)
        uvs.append((u_right, SIDE_V_TOP))
        tl = len(uvs)
        uvs.append((u_left, SIDE_V_TOP))
        side_uv_indices.append((bl, br, tr, tl))

    # --- Faces ---
    # OBJ indices are 1-based

    # Vertex indices (1-based):
    # Top ring: 1..6
    # Bottom ring: 7..12
    # Top center: 13
    # Bottom center: 14

    # Normal indices (1-based):
    # 1 = top (Y+)
    # 2 = bottom (Y-)
    # 3..8 = side normals

    top_normal = 1
    bot_normal = 2

    # Top face: fan triangulation from center (vertex 13) through top ring
    # Winding: counter-clockwise when viewed from above (Y+)
    # For pointy-top going clockwise (0,1,2,3,4,5), CCW from above means:
    # center, corner[i], corner[i+1]
    for i in range(NUM_SIDES):
        next_i = (i + 1) % NUM_SIDES
        # Vertex indices (1-based)
        v_center = 13
        v_i = i + 1
        v_next = next_i + 1
        # UV indices (1-based)
        uv_center = uv_top_center_idx + 1
        uv_i = uv_top_corners_start + i + 1
        uv_next = uv_top_corners_start + next_i + 1
        faces.append([
            (v_center, uv_center, top_normal),
            (v_i, uv_i, top_normal),
            (v_next, uv_next, top_normal),
        ])

    # Bottom face: fan triangulation from center (vertex 14) through bottom ring
    # Winding: counter-clockwise when viewed from below (Y-)
    # From below, the order is reversed: center, corner[i+1], corner[i]
    for i in range(NUM_SIDES):
        next_i = (i + 1) % NUM_SIDES
        v_center = 14
        v_i = i + 7       # bottom ring starts at index 7 (1-based)
        v_next = next_i + 7
        uv_center = uv_bot_center_idx + 1
        uv_i = uv_bot_corners_start + i + 1
        uv_next = uv_bot_corners_start + next_i + 1
        faces.append([
            (v_center, uv_center, bot_normal),
            (v_next, uv_next, bot_normal),
            (v_i, uv_i, bot_normal),
        ])

    # Side faces: quads (as two triangles each) connecting top and bottom rings
    # For side i: top[i], top[i+1], bottom[i+1], bottom[i]
    # Outward-facing winding (CCW from outside):
    # Triangle 1: top[i], bottom[i], bottom[i+1]
    # Triangle 2: top[i], bottom[i+1], top[i+1]
    for i in range(NUM_SIDES):
        next_i = (i + 1) % NUM_SIDES
        side_normal = i + 3  # 1-based: normals 3..8

        vt_i = i + 1         # top ring (1-based)
        vt_next = next_i + 1
        vb_i = i + 7         # bottom ring (1-based)
        vb_next = next_i + 7

        bl, br, tr, tl = side_uv_indices[i]
        # UV mapping: tl=top-left=top[i], tr=top-right=top[i+1],
        #             bl=bottom-left=bottom[i], br=bottom-right=bottom[i+1]
        # All 1-based
        uv_tl = tl + 1
        uv_tr = tr + 1
        uv_bl = bl + 1
        uv_br = br + 1

        # Triangle 1: top[i], bottom[i], bottom[i+1]
        faces.append([
            (vt_i, uv_tl, side_normal),
            (vb_i, uv_bl, side_normal),
            (vb_next, uv_br, side_normal),
        ])
        # Triangle 2: top[i], bottom[i+1], top[i+1]
        faces.append([
            (vt_i, uv_tl, side_normal),
            (vb_next, uv_br, side_normal),
            (vt_next, uv_tr, side_normal),
        ])

    # --- Write OBJ file ---
    output_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(output_dir, "hex_spirit_token.obj")

    with open(output_path, "w") as f:
        f.write("# Hex Spirit Token for Arc Spirits\n")
        f.write(f"# Dimensions: {WIDTH}w x {HEIGHT}h x {THICKNESS} thick\n")
        f.write(f"# Flat-top hexagon, Y-up\n")
        f.write(f"# Top face UVs -> left half, Bottom face UVs -> right half (X-mirrored)\n\n")

        f.write(f"# {len(vertices)} vertices\n")
        for x, y, z in vertices:
            f.write(f"v {x:.6f} {y:.6f} {z:.6f}\n")

        f.write(f"\n# {len(uvs)} texture coordinates\n")
        for u, v in uvs:
            f.write(f"vt {u:.6f} {v:.6f}\n")

        f.write(f"\n# {len(normals)} normals\n")
        for nx, ny, nz in normals:
            f.write(f"vn {nx:.6f} {ny:.6f} {nz:.6f}\n")

        # Top face group (flat shading)
        f.write(f"\n# Top face ({NUM_SIDES} triangles)\n")
        f.write("g top\n")
        f.write("s off\n")
        for face in faces[:NUM_SIDES]:
            indices = " ".join(f"{v}/{vt}/{vn}" for v, vt, vn in face)
            f.write(f"f {indices}\n")

        # Bottom face group (flat shading)
        f.write(f"\n# Bottom face ({NUM_SIDES} triangles)\n")
        f.write("g bottom\n")
        f.write("s off\n")
        for face in faces[NUM_SIDES:2 * NUM_SIDES]:
            indices = " ".join(f"{v}/{vt}/{vn}" for v, vt, vn in face)
            f.write(f"f {indices}\n")

        # Side faces group (flat shading)
        f.write(f"\n# Side faces ({NUM_SIDES * 2} triangles)\n")
        f.write("g sides\n")
        f.write("s off\n")
        for face in faces[2 * NUM_SIDES:]:
            indices = " ".join(f"{v}/{vt}/{vn}" for v, vt, vn in face)
            f.write(f"f {indices}\n")

    print(f"Generated OBJ file: {output_path}")
    print(f"  Vertices: {len(vertices)}")
    print(f"  UVs: {len(uvs)}")
    print(f"  Normals: {len(normals)}")
    print(f"  Faces (triangles): {len(faces)}")
    print(f"  - Top: {NUM_SIDES} tris")
    print(f"  - Bottom: {NUM_SIDES} tris")
    print(f"  - Sides: {NUM_SIDES * 2} tris")

    # --- Verification ---
    print("\n--- Verification ---")

    # Check vertex count: 6 top + 6 bottom + 2 centers = 14
    assert len(vertices) == 14, f"Expected 14 vertices, got {len(vertices)}"
    print(f"  Vertex count: {len(vertices)} (OK)")

    # Check face count: 6 top + 6 bottom + 12 sides = 24
    assert len(faces) == 24, f"Expected 24 faces, got {len(faces)}"
    print(f"  Face count: {len(faces)} (OK)")

    # Check top center Y position
    assert vertices[12][1] == HALF_THICKNESS, "Top center Y mismatch"
    print(f"  Top center Y: {vertices[12][1]} (OK)")

    # Check bottom center Y position
    assert vertices[13][1] == -HALF_THICKNESS, "Bottom center Y mismatch"
    print(f"  Bottom center Y: {vertices[13][1]} (OK)")

    # Check top face UV center is at (0.25, 0.5)
    assert abs(uvs[uv_top_center_idx][0] - 0.25) < 1e-6, "Top UV center U mismatch"
    assert abs(uvs[uv_top_center_idx][1] - 0.5) < 1e-6, "Top UV center V mismatch"
    print(f"  Top face UV center: ({uvs[uv_top_center_idx][0]}, {uvs[uv_top_center_idx][1]}) (OK)")

    # Check bottom face UV center is at (0.75, 0.5)
    assert abs(uvs[uv_bot_center_idx][0] - 0.75) < 1e-6, "Bottom UV center U mismatch"
    assert abs(uvs[uv_bot_center_idx][1] - 0.5) < 1e-6, "Bottom UV center V mismatch"
    print(f"  Bottom face UV center: ({uvs[uv_bot_center_idx][0]}, {uvs[uv_bot_center_idx][1]}) (OK)")

    # Check that top face UVs are in left half (U < 0.5)
    for i in range(NUM_SIDES):
        u, v = uvs[uv_top_corners_start + i]
        assert u <= 0.5 + 1e-6, f"Top UV corner {i} U={u} exceeds 0.5"
    print("  Top face UVs all in left half (OK)")

    # Check that bottom face UVs are in right half (U > 0.5)
    for i in range(NUM_SIDES):
        u, v = uvs[uv_bot_corners_start + i]
        assert u >= 0.5 - 1e-6, f"Bottom UV corner {i} U={u} below 0.5"
    print("  Bottom face UVs all in right half (OK)")

    # Check top normal direction
    assert normals[0] == (0.0, 1.0, 0.0), "Top normal not Y+"
    print("  Top normal: Y+ (OK)")

    # Check bottom normal direction
    assert normals[1] == (0.0, -1.0, 0.0), "Bottom normal not Y-"
    print("  Bottom normal: Y- (OK)")

    # Check side normals are horizontal (Y=0)
    for i in range(2, 2 + NUM_SIDES):
        assert abs(normals[i][1]) < 1e-6, f"Side normal {i} has non-zero Y"
    print("  Side normals: all horizontal (OK)")

    # Check hex dimensions
    xs = [v[0] for v in vertices[:12]]
    zs = [v[2] for v in vertices[:12]]
    actual_width = max(xs) - min(xs)
    actual_height = max(zs) - min(zs)
    assert abs(actual_width - WIDTH) < 1e-4, f"Width mismatch: {actual_width}"
    assert abs(actual_height - HEIGHT) < 1e-4, f"Height mismatch: {actual_height}"
    print(f"  Hex dimensions: {actual_width:.4f}w x {actual_height:.4f}h (OK)")

    # Verify UV mirror: top uses u = 0.25 + dx, bottom uses u = 0.75 - dx
    for i in range(NUM_SIDES):
        top_u = uvs[uv_top_corners_start + i][0]
        bot_u = uvs[uv_bot_corners_start + i][0]
        dx_top = top_u - 0.25
        dx_bot = 0.75 - bot_u
        assert abs(dx_top - dx_bot) < 1e-6, f"UV mirror mismatch at corner {i}: top_dx={dx_top}, bot_dx={dx_bot}"
    print("  Bottom face UV X-mirror: verified (OK)")

    print("\nAll verifications passed!")


if __name__ == "__main__":
    generate_obj()
