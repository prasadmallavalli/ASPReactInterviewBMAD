/**
 * Client-side mirror of `src/Application/DTOs/ProductDto.cs`. ASP.NET Core's
 * default System.Text.Json configuration camelCases property names on the
 * wire, so `Id`/`Name`/`Price`/`CategoryId` become `id`/`name`/`price`/`categoryId`
 * here -- matching the casing already assumed by `client/src/api/client.test.ts`.
 *
 * `decimal` has no TS equivalent -- `Price` is parsed as a plain `number` by
 * `JSON.parse` (via `apiFetch`), same as every other numeric field.
 */
export interface ProductDto {
  id: number;
  name: string;
  price: number;
  categoryId: number;
}
