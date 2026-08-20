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

/**
 * Client-side mirror of `src/Application/DTOs/UserDto.cs`. System.Text.Json's
 * default camelCasing turns `Id`/`Email` into `id`/`email` on the wire --
 * same convention as `ProductDto` above. Deliberately just `{ id, email }`:
 * the API never returns a password/hash, and the client never stores the raw
 * JWT (AD-5) -- the httpOnly `access_token` cookie is the sole session store.
 */
export interface UserDto {
  id: number;
  email: string;
}

/**
 * Client-side mirror of `src/Application/DTOs/CategoryDto.cs`. System.Text.Json's
 * default camelCasing turns `Id`/`Name` into `id`/`name` on the wire -- same
 * convention as `ProductDto` above. Used by `ProductForm` to populate
 * the Category dropdown from `GET /api/categories`.
 */
export interface CategoryDto {
  id: number;
  name: string;
}
