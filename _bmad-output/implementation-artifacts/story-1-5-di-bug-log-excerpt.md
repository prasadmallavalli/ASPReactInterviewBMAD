# Story 1.5 — DI Lifetime Bug: Log Excerpt (FR9 Postmortem Input)

This is a real, observed captive-dependency incident, reproduced against the
project's actual MSSQL instance (docker-compose) — not a simulated or
hand-written failure. It is saved verbatim for FR9's later blameless
postmortem.

## What was reproduced

`IProductRepository` was temporarily registered `AddSingleton` instead of
`AddScoped` in `src/Api/Program.cs`, while it still depends on the Scoped
`AppDbContext`. This makes `ProductRepository` a captive dependency: the
first request to resolve it captures one `AppDbContext` instance for the
lifetime of the app, and every subsequent request reuses that same instance.
`DbContext` is not thread-safe, so concurrent requests using it at the same
time throw.

## Environment

- `ASPNETCORE_ENVIRONMENT=Production` — required so ASP.NET Core's default
  `ValidateScopes`/`ValidateOnBuild` (on by default only in Development)
  does not throw immediately at first resolution and mask the real,
  runtime race condition.
- `ConnectionStrings__DefaultConnection` passed explicitly as an env var,
  since that connection string otherwise only lives in
  `appsettings.Development.json`.
- Real MSSQL instance via `docker compose up -d` (`aspfullstackbmad-mssql`,
  confirmed healthy before the run).

## Repro commands

```bash
docker compose up -d

ASPNETCORE_ENVIRONMENT=Production \
ConnectionStrings__DefaultConnection="Server=localhost,1433;Database=ASPFullStackBMAD;User Id=sa;Password=***ROTATED-DEV-PASSWORD-REMOVED***;TrustServerCertificate=True" \
dotnet run --project src/Api --no-launch-profile
```

```bash
seq 1 50 | xargs -P 50 -I{} curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5000/api/products | sort | uniq -c
```

Note: `--no-launch-profile` bypasses `launchSettings.json`, whose
`applicationUrl` (port 5087) only applies when a launch profile is used —
without one, Kestrel falls back to its default `http://localhost:5000`. The
repro therefore targeted port 5000 instead of the port used by the
`http`/`https` launch profiles; this is a port-only deviation from the
spec's example command, the reproduction mechanism itself is unchanged.

## Result

Of 50 concurrent `GET /api/products` requests against the Singleton-registered
repository: **48 returned HTTP 500, 2 returned HTTP 200.**

Re-running the identical burst after reverting `IProductRepository` to
`AddScoped`, twice in succession: **50/50 returned HTTP 200, zero
exceptions, both runs.**

## Correlation ID

`6054e1fe-829f-42b5-9110-56f331c9205e` — the correlation ID of the single
unhandled-exception trace highlighted below (the `ExceptionHandlerMiddleware`
block). Each of the 48 failed requests carried its own distinct correlation
ID; this is not one ID covering the whole incident.

## Verbatim console output (buggy / Singleton run)

Partial excerpt — showing 11 of the 48 `EntityFrameworkCore.Query` failure
blocks, plus the 1 `ExceptionHandlerMiddleware` unhandled-exception block
that reached the client, not the complete 48-failure output.

```
fail: Microsoft.EntityFrameworkCore.Query[10100]
      => SpanId:361bba7aaf2ac335, TraceId:60202b1ef2ec8d49ad531267ebda730d, ParentId:0000000000000000 => ConnectionId:0HNNTAN7LJU93 => RequestPath:/api/products RequestId:0HNNTAN7LJU93:00000001 => CorrelationId:68d53ab1-7c82-4dea-8973-2d1bec882212 => Api.Controllers.ProductsController.GetAll (Api)
      An exception occurred while iterating over the results of a query for context type 'Infrastructure.Data.AppDbContext'.
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
fail: Microsoft.EntityFrameworkCore.Query[10100]
      => SpanId:07b7fbf137532858, TraceId:011c2d2eb61b3ef7cc63245548755e71, ParentId:0000000000000000 => ConnectionId:0HNNTAN7LJU98 => RequestPath:/api/products RequestId:0HNNTAN7LJU98:00000001 => CorrelationId:80d8a111-2917-4449-9db5-57709ffe8518 => Api.Controllers.ProductsController.GetAll (Api)
      An exception occurred while iterating over the results of a query for context type 'Infrastructure.Data.AppDbContext'.
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
fail: Microsoft.EntityFrameworkCore.Query[10100]
      => SpanId:d479086a3acca605, TraceId:a50013cfed52c22673cd315680058200, ParentId:0000000000000000 => ConnectionId:0HNNTAN7LJU92 => RequestPath:/api/products RequestId:0HNNTAN7LJU92:00000001 => CorrelationId:8fc87e5e-4683-4931-b4e8-d125d48f9e71 => Api.Controllers.ProductsController.GetAll (Api)
      An exception occurred while iterating over the results of a query for context type 'Infrastructure.Data.AppDbContext'.
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
fail: Microsoft.EntityFrameworkCore.Query[10100]
      => SpanId:f9a8af6d7cf85cac, TraceId:0463e66e1a65648c0eddabf46e44ae40, ParentId:0000000000000000 => ConnectionId:0HNNTAN7LJU99 => RequestPath:/api/products RequestId:0HNNTAN7LJU99:00000001 => CorrelationId:6054e1fe-829f-42b5-9110-56f331c9205e => Api.Controllers.ProductsController.GetAll (Api)
      An exception occurred while iterating over the results of a query for context type 'Infrastructure.Data.AppDbContext'.
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
fail: Microsoft.EntityFrameworkCore.Query[10100]
      => SpanId:9479dbec798c2517, TraceId:ad54e8900fad04d3e7edbaeefbc2fb9c, ParentId:0000000000000000 => ConnectionId:0HNNTAN7LJU97 => RequestPath:/api/products RequestId:0HNNTAN7LJU97:00000001 => CorrelationId:db78ca20-1619-4b44-ae2e-5f86c38aa9ab => Api.Controllers.ProductsController.GetAll (Api)
      An exception occurred while iterating over the results of a query for context type 'Infrastructure.Data.AppDbContext'.
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
fail: Microsoft.EntityFrameworkCore.Query[10100]
      => SpanId:151447110979aaf0, TraceId:92c0688ef43c364fa0ed7f5d87acde88, ParentId:0000000000000000 => ConnectionId:0HNNTAN7LJU9D => RequestPath:/api/products RequestId:0HNNTAN7LJU9D:00000001 => CorrelationId:e954f4c3-3d66-4af9-91f4-e18de7e18326 => Api.Controllers.ProductsController.GetAll (Api)
      An exception occurred while iterating over the results of a query for context type 'Infrastructure.Data.AppDbContext'.
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
fail: Microsoft.EntityFrameworkCore.Query[10100]
      => SpanId:cb8373639588c5f9, TraceId:58dbe7de49c9afe8dc0d49507744b273, ParentId:0000000000000000 => ConnectionId:0HNNTAN7LJU9B => RequestPath:/api/products RequestId:0HNNTAN7LJU9B:00000001 => CorrelationId:14d18038-eecd-4d58-9bc2-470cc70b5ab5 => Api.Controllers.ProductsController.GetAll (Api)
      An exception occurred while iterating over the results of a query for context type 'Infrastructure.Data.AppDbContext'.
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
fail: Microsoft.EntityFrameworkCore.Query[10100]
      => SpanId:5cb4c900fefff429, TraceId:83c50367cc81f147146dd8b7cbc47b75, ParentId:0000000000000000 => ConnectionId:0HNNTAN7LJU94 => RequestPath:/api/products RequestId:0HNNTAN7LJU94:00000001 => CorrelationId:9aa13bd0-0a86-4a22-9c14-5639f5249eca => Api.Controllers.ProductsController.GetAll (Api)
      An exception occurred while iterating over the results of a query for context type 'Infrastructure.Data.AppDbContext'.
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
fail: Microsoft.EntityFrameworkCore.Query[10100]
      => SpanId:58dcb1ed6df3515d, TraceId:963cfb92153bb68159c87cea44642aca, ParentId:0000000000000000 => ConnectionId:0HNNTAN7LJU95 => RequestPath:/api/products RequestId:0HNNTAN7LJU95:00000001 => CorrelationId:22247a15-1ecb-4b0e-b5d7-5955ca6a2f96 => Api.Controllers.ProductsController.GetAll (Api)
      An exception occurred while iterating over the results of a query for context type 'Infrastructure.Data.AppDbContext'.
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
fail: Microsoft.EntityFrameworkCore.Query[10100]
      => SpanId:e7989a473fea3c76, TraceId:75f5fb66f35dab4c95f3679142765e07, ParentId:0000000000000000 => ConnectionId:0HNNTAN7LJU9A => RequestPath:/api/products RequestId:0HNNTAN7LJU9A:00000001 => CorrelationId:a65a4925-068d-47c2-aa4b-1d526a2a9348 => Api.Controllers.ProductsController.GetAll (Api)
      An exception occurred while iterating over the results of a query for context type 'Infrastructure.Data.AppDbContext'.
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
fail: Microsoft.EntityFrameworkCore.Query[10100]
      => SpanId:1246fe282f9741f6, TraceId:38f2cf6cd31b406886870205e649381d, ParentId:0000000000000000 => ConnectionId:0HNNTAN7LJU9C => RequestPath:/api/products RequestId:0HNNTAN7LJU9C:00000001 => CorrelationId:37ed11d5-4023-415b-96ec-b455ff079fb1 => Api.Controllers.ProductsController.GetAll (Api)
      An exception occurred while iterating over the results of a query for context type 'Infrastructure.Data.AppDbContext'.
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
fail: Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware[1]
      => SpanId:f9a8af6d7cf85cac, TraceId:0463e66e1a65648c0eddabf46e44ae40, ParentId:0000000000000000 => ConnectionId:0HNNTAN7LJU99 => RequestPath:/api/products RequestId:0HNNTAN7LJU99:00000001 => CorrelationId:6054e1fe-829f-42b5-9110-56f331c9205e
      An unhandled exception has occurred while executing the request.
      System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext. For more information on how to avoid threading issues with DbContext, see https://go.microsoft.com/fwlink/?linkid=2097913.
         at Microsoft.EntityFrameworkCore.Infrastructure.Internal.ConcurrencyDetector.EnterCriticalSection()
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
         at Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync[TSource](IQueryable`1 source, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync[TSource](IQueryable`1 source, CancellationToken cancellationToken)
         at Infrastructure.Repositories.ProductRepository.GetAllAsync(CancellationToken cancellationToken) in /Users/prasadmallavalli/Documents/GitHub/ASPFullStackBMAD/src/Infrastructure/Repositories/ProductRepository.cs:line 31
         at Application.Services.ProductService.GetAllAsync(CancellationToken cancellationToken) in /Users/prasadmallavalli/Documents/GitHub/ASPFullStackBMAD/src/Application/Services/ProductService.cs:line 30
         at Api.Controllers.ProductsController.GetAll(CancellationToken cancellationToken) in /Users/prasadmallavalli/Documents/GitHub/ASPFullStackBMAD/src/Api/Controllers/ProductsController.cs:line 29
         at lambda_method4(Closure, Object)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ActionMethodExecutor.AwaitableObjectResultExecutor.Execute(ActionContext actionContext, IActionResultTypeMapper mapper, ObjectMethodExecutor executor, Object controller, Object[] arguments)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.<InvokeActionMethodAsync>g__Awaited|12_0(ControllerActionInvoker invoker, ValueTask`1 actionResultValueTask)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.<InvokeNextActionFilterAsync>g__Awaited|10_0(ControllerActionInvoker invoker, Task lastTask, State next, Scope scope, Object state, Boolean isCompleted)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.Rethrow(ActionExecutedContextSealed context)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.Next(State& next, Scope& scope, Object& state, Boolean& isCompleted)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.InvokeInnerFilterAsync()
      --- End of stack trace from previous location ---
         at Microsoft.AspNetCore.Mvc.Infrastructure.ResourceInvoker.<InvokeFilterPipelineAsync>g__Awaited|20_0(ResourceInvoker invoker, Task lastTask, State next, Scope scope, Object state, Boolean isCompleted)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ResourceInvoker.<InvokeAsync>g__Awaited|17_0(ResourceInvoker invoker, Task task, IDisposable scope)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ResourceInvoker.<InvokeAsync>g__Awaited|17_0(ResourceInvoker invoker, Task task, IDisposable scope)
         at Microsoft.AspNetCore.Authorization.AuthorizationMiddleware.Invoke(HttpContext context)
         at Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddlewareImpl.<Invoke>g__Awaited|10_0(ExceptionHandlerMiddlewareImpl middleware, HttpContext context, Task task)
```

## Root cause

`AddSingleton<IProductRepository, ProductRepository>()` made `ProductRepository`
— and therefore the `AppDbContext` instance injected into its constructor —
live for the whole application lifetime instead of one request. `AppDbContext`
is registered Scoped (EF Core's `AddDbContext` default), so the first request
to resolve `ProductRepository` captured that request's `AppDbContext` and held
onto it forever (a "captive dependency"). Every later request reused the same
`ProductRepository` instance and therefore the same `AppDbContext`. `DbContext`
is documented as not thread-safe: concurrent requests calling
`_context.Products.AsNoTracking().ToListAsync(...)` on the same instance
raced on EF Core's internal `ConcurrencyDetector`, which throws
`InvalidOperationException: A second operation was started on this context
instance before a previous operation completed` whenever it detects
overlapping use.

This is exactly the failure mode AD-4 ("DbContext/repositories = Scoped")
exists to prevent.

## Fix

`src/Api/Program.cs` line 42 reverted to
`AddScoped<IProductRepository, ProductRepository>()`, with a why-comment
citing AD-4 and this file. Re-running the identical 50-request concurrent
burst against the fixed registration, twice in succession, produced 50/50
HTTP 200 responses with no exceptions in the console output both times.
