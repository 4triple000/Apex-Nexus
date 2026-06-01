import { useState, useEffect } from "react";
import { canvasApi, type Product } from "../api";

const CYAN = "#00D2D3";
const GREEN = "#55EFC4";

export default function ProductGrid() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [flash, setFlash]         = useState<number | null>(null);
  const [toast, setToast]         = useState<string | null>(null);

  useEffect(() => {
    canvasApi.getProducts()
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const buy = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.stock === 0) return;
    setFlash(product.id);
    setCartCount(c => c + 1);
    try {
      const { product: updated } = await canvasApi.buyProduct(product.id);
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      setToast(`${product.emoji} Added to cart!`);
      setTimeout(() => setToast(null), 2000);
    } catch { /* optimistic rollback would go here */ }
    setTimeout(() => setFlash(null), 600);
  };

  return (
    <div style={{ background: "#0A0A12", borderRadius: 12, overflow: "hidden", position: "relative" }}
         onClick={e => e.stopPropagation()}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "absolute", top: 36, left: 0, right: 0, textAlign: "center", zIndex: 10 }}>
          <div style={{ display: "inline-block", fontSize: 9, fontWeight: 700, color: GREEN, background: "rgba(85,239,196,0.15)", borderRadius: 99, padding: "4px 12px", border: "1px solid rgba(85,239,196,0.25)" }}>
            {toast}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#E8EAED" }}>🛍️ Shop</div>
        <div style={{ fontSize: 9, fontWeight: 700, color: CYAN, background: "rgba(0,210,211,0.1)", borderRadius: 99, padding: "2px 8px" }}>
          🛒 {cartCount} · {products.reduce((s, p) => s + p.sales, 0)} sold
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 16, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 16, height: 16, border: "2px solid rgba(162,155,254,0.2)", borderTopColor: "#A29BFE", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 8 }}>
          {products.slice(0, 4).map(p => {
            const flashing   = flash === p.id;
            const outOfStock = p.stock === 0;
            return (
              <div key={p.id} style={{ background: `${p.color}0d`, borderRadius: 10, border: `1px solid ${p.color}22`, padding: "8px 7px" }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{p.emoji}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#E8EAED", marginBottom: 1 }}>{p.name}</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: p.color, marginBottom: 2 }}>${p.price}</div>
                <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", marginBottom: 5 }}>{p.stock} left</div>
                <button
                  onClick={e => buy(p, e)}
                  disabled={outOfStock}
                  style={{
                    width: "100%", padding: "4px 0", borderRadius: 7, border: "none",
                    background: outOfStock ? "rgba(255,255,255,0.04)" : flashing ? p.color : `${p.color}20`,
                    color: outOfStock ? "rgba(255,255,255,0.2)" : flashing ? "white" : p.color,
                    fontSize: 9, fontWeight: 700, cursor: outOfStock ? "default" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {outOfStock ? "Sold Out" : flashing ? "✓ Added!" : "+ Buy"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
