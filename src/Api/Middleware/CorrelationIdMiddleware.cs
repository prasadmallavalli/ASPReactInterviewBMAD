namespace Api.Middleware;

/// <summary>
/// Ties every log line emitted during a request to a single correlation ID
/// (AD-6), without any per-call-site plumbing in controllers/services. This
/// is prerequisite groundwork for Story 1.5's postmortem, which needs to
/// reconstruct a request's full lifecycle from logs alone.
///
/// Registered FIRST in Program.cs (before UseExceptionHandler()) so the log
/// scope also wraps the exception handler's own catch block and its
/// unhandled-exception log line — the entry a postmortem needs most.
/// </summary>
public class CorrelationIdMiddleware
{
    private const string HeaderName = "X-Correlation-Id";

    private readonly RequestDelegate _next;
    private readonly ILogger<CorrelationIdMiddleware> _logger;

    public CorrelationIdMiddleware(RequestDelegate next, ILogger<CorrelationIdMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // An empty header value is treated the same as an absent header
        // (I/O matrix "Empty header" row) — StringValues.ToString() on a
        // missing header is also "", so IsNullOrEmpty covers both cases in
        // one check.
        var incoming = context.Request.Headers[HeaderName].ToString();
        var correlationId = string.IsNullOrEmpty(incoming) ? Guid.NewGuid().ToString() : incoming;

        // Set via OnStarting, not immediately: UseExceptionHandler's own
        // exception handling calls Response.Clear() (which clears response
        // headers, unconditionally) before writing the ProblemDetails body.
        // Setting the header immediately here would still get wiped by that
        // clear on a 500. OnStarting fires right before the response is
        // actually sent — after any such clearing has already happened — so
        // the header survives on every response, including error ones
        // (review finding, confirmed against ASP.NET Core's
        // ExceptionHandlerMiddlewareImpl/ResponseExtensions.Clear source).
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = correlationId;
            return Task.CompletedTask;
        });

        // BeginScope (not an explicit parameter on every log call) is what
        // makes this "no per-call-site plumbing" — every log line written by
        // framework or application code while this scope is active picks up
        // the correlation ID automatically. This only reaches console output
        // because appsettings.json sets Logging:Console:IncludeScopes: true;
        // without that, the scope data is silently dropped (AC3 wouldn't be
        // observable).
        using (_logger.BeginScope("CorrelationId:{CorrelationId}", correlationId))
        {
            await _next(context);
        }
    }
}
