using System.Net;
using Application.DTOs;
using Application.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Application.Tests.Integration;

/// <summary>
/// Retro fix (Epic 1, Finding B): CorrelationIdMiddleware's one load-bearing
/// guarantee -- that X-Correlation-Id survives on error responses too, via
/// its OnStarting-deferred header write surviving UseExceptionHandler's
/// Response.Clear() -- was previously only ever verified by hand (the code
/// comment says so explicitly). No automated test exercised it.
///
/// Forces a real unhandled exception through the real, unmodified pipeline
/// by swapping in a throwing IProductService stub via ConfigureTestServices
/// -- GET /api/products then hits the real CorrelationIdMiddleware ->
/// UseExceptionHandler -> routing -> controller -> service chain exactly as
/// Program.cs wires it, with the exception originating from the real
/// service call site rather than a test-only endpoint bolted onto the app.
/// No cookie/auth needed: GET is public (Story 2.3), so the request reaches
/// the controller and its service call before any auth check would matter.
/// </summary>
[Collection("WebApplicationFactory")]
public class CorrelationIdMiddlewareTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public CorrelationIdMiddlewareTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureTestServices(services =>
            {
                services.AddScoped<IProductService, ThrowingProductService>();
            });
        });
    }

    [Fact]
    public async Task GetProducts_WhenServiceThrows_ReturnsCorrelationIdHeaderOn500()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/products");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.True(
            response.Headers.TryGetValues("X-Correlation-Id", out var values),
            "X-Correlation-Id header was missing from the 500 response.");
        Assert.False(string.IsNullOrWhiteSpace(values!.Single()));
    }

    [Fact]
    public async Task GetProducts_WhenServiceThrows_EchoesIncomingCorrelationIdOn500()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Correlation-Id", "test-correlation-id-123");

        var response = await client.GetAsync("/api/products");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        response.Headers.TryGetValues("X-Correlation-Id", out var values);
        Assert.Equal("test-correlation-id-123", values!.Single());
    }

    /// <summary>
    /// Every method throws -- this stub exists solely to force an unhandled
    /// exception through the real pipeline. GetAllAsync is the only one
    /// GET /api/products actually calls.
    /// </summary>
    private class ThrowingProductService : IProductService
    {
        public Task<ProductDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Deliberate test failure to exercise the error pipeline.");

        public Task<IEnumerable<ProductDto>> GetAllAsync(CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Deliberate test failure to exercise the error pipeline.");

        public Task<(ProductWriteResult Result, ProductDto? Product)> CreateAsync(ProductRequestDto request, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Deliberate test failure to exercise the error pipeline.");

        public Task<(ProductWriteResult Result, ProductDto? Product)> UpdateAsync(int id, ProductRequestDto request, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Deliberate test failure to exercise the error pipeline.");

        public Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Deliberate test failure to exercise the error pipeline.");
    }
}
