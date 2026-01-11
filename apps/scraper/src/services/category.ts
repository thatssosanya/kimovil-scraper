import { Effect, Layer, Context, Data } from "effect";
import { SqlClient, SqlError } from "@effect/sql";

export interface Category {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  createdAt: number;
  updatedAt: number;
}

export class CategoryError extends Data.TaggedError("CategoryError")<{
  message: string;
  cause?: unknown;
}> {}

export interface CategoryService {
  readonly getById: (id: number) => Effect.Effect<Category | null, CategoryError>;
  readonly getBySlug: (slug: string) => Effect.Effect<Category | null, CategoryError>;
  readonly getAll: () => Effect.Effect<Category[], CategoryError>;
  readonly create: (input: { name: string; slug: string; parentId?: number }) => Effect.Effect<Category, CategoryError>;
}

export const CategoryService = Context.GenericTag<CategoryService>("CategoryService");

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  created_at: number;
  updated_at: number;
};

const mapCategoryRow = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  parentId: row.parent_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const wrapSqlError = (error: SqlError.SqlError): CategoryError =>
  new CategoryError({ message: error.message, cause: error });

export const CategoryServiceLive = Layer.effect(
  CategoryService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return CategoryService.of({
      getById: (id: number) =>
        sql<CategoryRow>`SELECT * FROM device_categories WHERE id = ${id}`.pipe(
          Effect.map((rows) => (rows[0] ? mapCategoryRow(rows[0]) : null)),
          Effect.mapError(wrapSqlError),
        ),

      getBySlug: (slug: string) =>
        sql<CategoryRow>`SELECT * FROM device_categories WHERE slug = ${slug}`.pipe(
          Effect.map((rows) => (rows[0] ? mapCategoryRow(rows[0]) : null)),
          Effect.mapError(wrapSqlError),
        ),

      getAll: () =>
        sql<CategoryRow>`SELECT * FROM device_categories ORDER BY name`.pipe(
          Effect.map((rows) => rows.map(mapCategoryRow)),
          Effect.mapError(wrapSqlError),
        ),

      create: (input) =>
        Effect.gen(function* () {
          const parentId = input.parentId ?? null;

          yield* sql`
            INSERT INTO device_categories (name, slug, parent_id, created_at, updated_at)
            VALUES (${input.name}, ${input.slug}, ${parentId}, unixepoch(), unixepoch())
          `;

          const rows = yield* sql<CategoryRow>`
            SELECT * FROM device_categories WHERE slug = ${input.slug}
          `;
          const row = rows[0];
          if (!row) {
            return yield* Effect.fail(
              new CategoryError({ message: "Failed to get inserted category" }),
            );
          }
          return mapCategoryRow(row);
        }).pipe(
          Effect.mapError((e) =>
            e instanceof CategoryError ? e : wrapSqlError(e),
          ),
        ),
    });
  }),
);
