/**
 * Script Final para Carregar Produtos no Resumo do Pedido
 * Funciona em Desktop e Mobile com detecção melhorada
 */

(function() {
    'use strict';

    // Configuração
    const CONFIG = {
        storageKey: 'carrinho_produtos',
        maxRetries: 5,
        retryDelay: 500
    };

    // Função principal para carregar produtos
    function carregarProdutos() {
        try {
            // 1. Obter dados do localStorage
            const produtosJSON = localStorage.getItem(CONFIG.storageKey);
            
            if (!produtosJSON) {
                console.warn('⚠️ Nenhum produto encontrado em localStorage');
                return false;
            }

            const produtos = JSON.parse(produtosJSON);
            
            if (!Array.isArray(produtos) || produtos.length === 0) {
                console.warn('⚠️ Array de produtos vazio ou inválido');
                return false;
            }

            console.log('✅ Produtos carregados:', produtos);

            // 2. Injetar CSS
            injetarCSS();

            // 3. Inserir produtos no DESKTOP (sidebar)
            const containerDesktop = encontrarContainerDesktop();
            if (containerDesktop) {
                criarElementosProdutos(produtos, containerDesktop, 'desktop');
                console.log('✅ Produtos inseridos no DESKTOP');
            } else {
                console.warn('⚠️ Container desktop não encontrado');
            }

            // 4. Inserir produtos no MOBILE
            const containerMobile = encontrarContainerMobile();
            if (containerMobile) {
                criarElementosProdutos(produtos, containerMobile, 'mobile');
                console.log('✅ Produtos inseridos no MOBILE');
            } else {
                console.warn('⚠️ Container mobile não encontrado');
            }

            // 5. Atualizar totais
            atualizarTotais(produtos);

            console.log('✅ Produtos exibidos com sucesso!');
            return true;

        } catch (error) {
            console.error('❌ Erro ao carregar produtos:', error);
            return false;
        }
    }

    // Função para encontrar container no DESKTOP
    function encontrarContainerDesktop() {
        // Tentar encontrar container existente
        let container = document.getElementById('productsListDesktop');
        if (container) {
            console.log('✅ Container desktop existente encontrado');
            return container;
        }

        // Tentar encontrar a sidebar
        const sidebar = document.querySelector('aside.sidebar');
        if (sidebar) {
            // Procurar pelo título do resumo
            const titulo = sidebar.querySelector('.order-summary-title');
            if (titulo) {
                // Criar container após o título
                container = document.createElement('div');
                container.id = 'productsListDesktop';
                container.className = 'products-list';
                titulo.insertAdjacentElement('afterend', container);
                
                // Inserir divisor
                const divisor = document.createElement('div');
                divisor.style.cssText = 'border-top: 1px solid #e5e7eb; margin: 16px 0;';
                container.insertAdjacentElement('afterend', divisor);
                
                console.log('✅ Container desktop criado após título da sidebar');
                return container;
            }
        }

        return null;
    }

    // Função para encontrar container no MOBILE - VERSÃO CORRIGIDA
    function encontrarContainerMobile() {
        // Tentar encontrar container existente
        let container = document.getElementById('productsListMobile');
        if (container) {
            console.log('✅ Container mobile existente encontrado');
            return container;
        }

        // Procurar pela estrutura mobile: .order-summary-mobile
        const orderSummaryMobile = document.querySelector('.order-summary-mobile');
        
        if (!orderSummaryMobile) {
            console.warn('⚠️ .order-summary-mobile não encontrado');
            return null;
        }

        // Procurar pelo #summaryContent dentro do mobile
        const summaryContent = orderSummaryMobile.querySelector('#summaryContent');
        
        if (!summaryContent) {
            console.warn('⚠️ #summaryContent não encontrado');
            return null;
        }

        // Procurar pelos order-totals dentro do summaryContent
        const orderTotalsMobile = summaryContent.querySelector('.order-totals');
        
        if (!orderTotalsMobile) {
            console.warn('⚠️ .order-totals dentro de #summaryContent não encontrado');
            return null;
        }

        // Criar container ANTES dos totais
        container = document.createElement('div');
        container.id = 'productsListMobile';
        container.className = 'products-list products-list-mobile';
        
        // Inserir ANTES dos totais
        orderTotalsMobile.insertAdjacentElement('beforebegin', container);
        
        // Inserir divisor DEPOIS dos produtos
        const divisor = document.createElement('div');
        divisor.style.cssText = 'border-top: 1px solid #e5e7eb; margin: 16px 0;';
        container.insertAdjacentElement('afterend', divisor);
        
        console.log('✅ Container mobile criado antes dos totais');
        return container;
    }

    // Função para criar elementos dos produtos
    function criarElementosProdutos(produtos, container, tipo = 'desktop') {
        // Limpar container
        container.innerHTML = '';

        // Criar cada produto
        produtos.forEach((produto, index) => {
            try {
                const produtoDiv = document.createElement('div');
                produtoDiv.className = 'product-item';
                produtoDiv.dataset.index = index;
                produtoDiv.dataset.type = tipo;

                // Extrair dados do produto (suporta múltiplos formatos)
                const nome = produto.nome || produto.name || produto.title || 'Produto sem nome';
                const quantidade = parseInt(produto.quantidade || produto.quantity || 1);
                const preco = parseFloat(produto.preco || produto.price || produto.valor || 0);
                const foto = produto.foto || produto.image || produto.img || produto.imagem || '';

                // Formatar preço
                const precoFormatado = preco.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                });

                // Calcular subtotal do produto
                const subtotalProduto = preco * quantidade;
                const subtotalFormatado = subtotalProduto.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                });

                // Montar HTML com imagem
                const imagemHTML = foto ? `<img src="${sanitizeHTML(foto)}" alt="${sanitizeHTML(nome)}" class="product-image" onerror="this.style.display='none'">` : '';
                
                produtoDiv.innerHTML = `
                    ${imagemHTML}
                    <div class="product-info">
                        <div class="product-name">${sanitizeHTML(nome)}</div>
                        <div class="product-qty">Qtd: ${quantidade} × ${precoFormatado}</div>
                    </div>
                    <div class="product-price">${subtotalFormatado}</div>
                `;

                container.appendChild(produtoDiv);
                console.log(`✅ Produto ${index + 1} adicionado (${tipo}): ${nome}`);

            } catch (error) {
                console.error(`❌ Erro ao processar produto ${index}:`, error);
            }
        });
    }

    // Função para injetar CSS
    function injetarCSS() {
        // Verificar se CSS já foi injetado
        if (document.getElementById('products-list-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'products-list-styles';
        style.textContent = `
            .products-list {
                margin-bottom: 20px;
                max-height: 400px;
                overflow-y: auto;
                padding: 0;
            }

            .products-list-mobile {
                max-height: 300px;
            }

            .product-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                padding: 12px 0;
                border-bottom: 1px solid #f0f0f0;
                font-size: 14px;
                animation: slideIn 0.3s ease-out;
            }

            .product-image {
                width: 60px;
                height: 60px;
                object-fit: cover;
                border-radius: 6px;
                flex-shrink: 0;
                background: #f5f5f5;
            }

            .product-item:last-child {
                border-bottom: none;
            }

            .product-info {
                flex: 1;
                padding-right: 10px;
            }

            .product-name {
                font-weight: 500;
                color: #333;
                margin-bottom: 4px;
                word-break: break-word;
            }

            .product-qty {
                font-size: 12px;
                color: #999;
            }

            .product-price {
                font-weight: 600;
                color: #333;
                text-align: right;
                min-width: 80px;
                white-space: nowrap;
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @media (max-width: 768px) {
                .products-list {
                    max-height: 300px;
                }

                .product-item {
                    padding: 10px 0;
                    font-size: 13px;
                    gap: 10px;
                }

                .product-image {
                    width: 50px;
                    height: 50px;
                }

                .product-price {
                    min-width: 70px;
                }
            }
        `;

        document.head.appendChild(style);
        console.log('✅ CSS injetado com sucesso');
    }

    // Função para atualizar totais
    function atualizarTotais(produtos) {
        try {
            // Calcular subtotal total
            const subtotal = produtos.reduce((total, produto) => {
                const preco = parseFloat(produto.preco || produto.price || 0);
                const quantidade = parseInt(produto.quantidade || produto.quantity || 1);
                return total + (preco * quantidade);
            }, 0);

            const subtotalFormatado = subtotal.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });

            // Atualizar subtotal no DESKTOP
            const subtotalElementsDesktop = document.querySelectorAll('aside.sidebar .order-totals .total-row');
            if (subtotalElementsDesktop.length > 0) {
                const priceSpan = subtotalElementsDesktop[0].querySelector('span:last-child');
                if (priceSpan && priceSpan.textContent === '...') {
                    priceSpan.textContent = subtotalFormatado;
                    console.log('✅ Subtotal desktop atualizado:', subtotalFormatado);
                }
            }

            // Atualizar subtotal no MOBILE - VERSÃO CORRIGIDA
            const summaryContent = document.querySelector('.order-summary-mobile #summaryContent');
            if (summaryContent) {
                const subtotalElementsMobile = summaryContent.querySelectorAll('.order-totals .total-row');
                if (subtotalElementsMobile.length > 0) {
                    const priceSpan = subtotalElementsMobile[0].querySelector('span:last-child');
                    if (priceSpan && priceSpan.textContent === '...') {
                        priceSpan.textContent = subtotalFormatado;
                        console.log('✅ Subtotal mobile atualizado:', subtotalFormatado);
                    }
                }
            }

            // Atualizar total final
            atualizarTotalFinal(subtotal);

        } catch (error) {
            console.error('❌ Erro ao atualizar totais:', error);
        }
    }

    // Função para atualizar total final
    function atualizarTotalFinal(subtotal) {
        try {
            let frete = 0;

            // Obter valor do frete selecionado
            const shippingOption = document.querySelector('.shipping-option.selected');
            if (shippingOption) {
                const priceText = shippingOption.querySelector('.shipping-price')?.textContent || 'GRÁTIS';
                if (priceText !== 'GRÁTIS') {
                    frete = parseFloat(priceText.replace(/[^\d,.-]/g, '').replace(',', '.'));
                }
            }

            const total = subtotal + frete;
            const totalFormatado = total.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });

            // Atualizar total na sidebar (desktop)
            const totalElementsDesktop = document.querySelectorAll('aside.sidebar .order-totals .total-row.final');
            totalElementsDesktop.forEach(el => {
                const priceSpan = el.querySelector('span:last-child');
                if (priceSpan && priceSpan.textContent === '...') {
                    priceSpan.textContent = totalFormatado;
                }
            });

            // Atualizar total no mobile - VERSÃO CORRIGIDA
            const summaryContent = document.querySelector('.order-summary-mobile #summaryContent');
            if (summaryContent) {
                const totalElementsMobile = summaryContent.querySelectorAll('.order-totals .total-row.final');
                totalElementsMobile.forEach(el => {
                    const priceSpan = el.querySelector('span:last-child');
                    if (priceSpan && priceSpan.textContent === '...') {
                        priceSpan.textContent = totalFormatado;
                    }
                });
            }

            // Atualizar total no toggle mobile
            const mobileTotalPrice = document.getElementById('mobileTotalPrice');
            if (mobileTotalPrice && mobileTotalPrice.textContent === '...') {
                mobileTotalPrice.textContent = totalFormatado;
            }

            console.log('✅ Total atualizado:', totalFormatado);

        } catch (error) {
            console.error('❌ Erro ao atualizar total final:', error);
        }
    }

    // Função para sanitizar HTML
    function sanitizeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Função para tentar carregar com retry
    function carregarComRetry(tentativa = 0) {
        if (tentativa >= CONFIG.maxRetries) {
            console.error('❌ Máximo de tentativas atingido');
            return;
        }

        if (carregarProdutos()) {
            return; // Sucesso
        }

        // Tentar novamente
        console.log(`⏳ Tentativa ${tentativa + 1}/${CONFIG.maxRetries}...`);
        setTimeout(() => {
            carregarComRetry(tentativa + 1);
        }, CONFIG.retryDelay);
    }

    // Inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📦 Iniciando carregamento de produtos (Desktop + Mobile)...');
            carregarComRetry();
        });
    } else {
        console.log('📦 Iniciando carregamento de produtos (Desktop + Mobile)...');
        carregarComRetry();
    }

    // Recarregar quando mudar opção de frete
    document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('.shipping-option').forEach(option => {
            option.addEventListener('click', function() {
                const produtosJSON = localStorage.getItem(CONFIG.storageKey);
                if (produtosJSON) {
                    const produtos = JSON.parse(produtosJSON);
                    const subtotal = produtos.reduce((total, produto) => {
                        const preco = parseFloat(produto.preco || produto.price || 0);
                        const quantidade = parseInt(produto.quantidade || produto.quantity || 1);
                        return total + (preco * quantidade);
                    }, 0);
                    atualizarTotalFinal(subtotal);
                }
            });
        });
    });

})();
