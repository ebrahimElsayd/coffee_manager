-- Compatibility layer for the customer and manager applications.
-- Customizations are intentionally dynamic: a product may have any groups, or none.

alter table public.products
  add column if not exists description_ar text;

alter table public.product_customization_groups
  add column if not exists name_ar text,
  add column if not exists min_selections integer not null default 0,
  add column if not exists max_selections integer not null default 1;

alter table public.product_customization_groups
  drop constraint if exists product_customization_groups_selection_range;

alter table public.product_customization_groups
  add constraint product_customization_groups_selection_range
  check (min_selections >= 0 and max_selections >= min_selections);

alter table public.product_customization_choices
  add column if not exists name_ar text;

alter table public.order_items
  add column if not exists product_name_ar text,
  add column if not exists selected_options jsonb not null default '[]'::jsonb;

alter table public.order_items
  drop constraint if exists order_items_selected_options_is_array;

alter table public.order_items
  add constraint order_items_selected_options_is_array
  check (jsonb_typeof(selected_options) = 'array');

comment on column public.order_items.selected_options is
  'Snapshot array of selected customization group/choice ids, bilingual labels, and price deltas.';

create index if not exists order_items_product_idx on public.order_items(product_id);
create index if not exists customization_groups_product_idx
  on public.product_customization_groups(product_id, display_order);
create index if not exists customization_choices_group_idx
  on public.product_customization_choices(group_id, display_order);
