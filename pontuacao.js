/**
 * pontuacao.js
 */

const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const btnsLogout = document.querySelectorAll('.btn-logout');

// Função de busca e renderização
async function carregarPontuacao() {
    const container = document.getElementById('container-pontuacao');
    if (!container) return;

    const { data: regras, error } = await supabaseClient
        .from('pontuacao')
        .select('id, pontos, tipo, explicacao')
        .order('id', { ascending: true });

    if (error) {
        showToast("Erro ao carregar pontuações.");
        return;
    }

    container.innerHTML = ''; // Limpa o container

    regras.forEach(r => {
        const divLinha = document.createElement('div'); 
        divLinha.innerHTML = `
                <div class="items-center bg-gray-800 p-6 rounded-lg shadow-sm mb-3 border border-gray-200/20 flex flex-col gap-4">
                    <div class="flex w-full gap-4 items-center">
                        <div class="flex md:block items-center gap-3">
                            <span class="text-gray-800 text-lg ${r.pontos < 0 ? "bg-red-400" : "bg-white" } px-3 py-1 rounded-full">${r.pontos > 0 ? "+" + r.pontos : r.pontos}</span>
                            <span class="md:hidden font-bold text-gray-400">Pontos</span>
                        </div>
                        <div class="font-semibold text-white uppercase font-light">
                            ${r.tipo || 'Sem título'}
                        </div>
                    </div>
                    <div class="text-sm text-white/50 italic font-light w-full">
                        ${r.explicacao || ''}
                    </div>
                </div>
        `;
        container.appendChild(divLinha);
    });
}

// Lógica original de logout e toast
function showToast(mensagem) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = mensagem;
        toast.className = "fixed top-5 right-5 z-[60] text-white px-5 py-3 rounded-lg shadow-xl font-medium bg-emerald-600 transition-all duration-300 opacity-100 translate-y-0";
        setTimeout(() => {
            toast.className = "fixed top-5 right-5 z-[60] text-white px-5 py-3 rounded-lg shadow-xl font-medium bg-emerald-600 transition-all duration-300 translate-y-[-20px] opacity-0";
        }, 3000);
    }
}

btnsLogout.forEach(botao => {
    botao.addEventListener('click', async () => { 
        await supabaseClient.auth.signOut(); 
        window.location.href = "index.html"; 
    });
});

// Inicialização
document.addEventListener('DOMContentLoaded', carregarPontuacao);