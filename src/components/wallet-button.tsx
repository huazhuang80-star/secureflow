import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWeb3 } from "@/contexts/web3-context";
import { useState } from "react";
import { Copy, LogOut, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function WalletButton() {
  const { wallet, connectWallet, disconnectWallet, refreshBalance } = useWeb3();
  const [networkIconError, setNetworkIconError] = useState(false);
  const [walletIconError, setWalletIconError] = useState(false);
  const { toast } = useToast();

  const handleConnect = () => {
    void connectWallet();
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const handleCopyAddress = async () => {
    if (wallet.address) {
      await navigator.clipboard.writeText(wallet.address);
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
      });
    }
  };

  const handleRefreshBalance = async () => {
    if (refreshBalance) {
      await refreshBalance();
      toast({
        title: "Balance refreshed",
        description: "Wallet balance has been updated",
      });
    }
  };

  if (!wallet.isConnected || !wallet.address) {
    return (
      <Button
        onClick={() => {
          void handleConnect();
        }}
        variant="default"
      >
        Connect Wallet
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="font-mono flex items-center gap-2 px-3 md:px-4 py-2 bg-muted/50 hover:bg-muted/70 border border-border/40 max-w-[160px] md:max-w-none"
        >
          {/* Desktop/tablet: show network + balance + avatar */}
          <div className="hidden md:flex items-center gap-2">
            {/* XLM (Stellar Lumens) icon */}
            <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center">
              {!networkIconError ? (
                <img
                  src="/xlm-icon.svg"
                  alt="XLM"
                  className="w-full h-full object-contain"
                  onError={() => setNetworkIconError(true)}
                />
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full"
                >
                  <circle cx="8" cy="8" r="8" fill="#7D00FF" />
                  <path
                    d="M8 2L9.5 6.5L14 8L9.5 9.5L8 14L6.5 9.5L2 8L6.5 6.5L8 2Z"
                    fill="white"
                  />
                </svg>
              )}
            </div>

            <span>{Number(wallet.balance || 0).toFixed(4)} XLM</span>
            <span className="text-muted-foreground">·</span>

            {/* Dynamic wallet avatar */}
            <div className="w-4 h-4 rounded-full overflow-hidden">
              {!walletIconError ? (
                <img
                  src={`https://effigy.im/a/${wallet.address}.svg`}
                  alt="Wallet"
                  className="w-full h-full object-cover"
                  onError={() => setWalletIconError(true)}
                />
              ) : (
                <div className="w-full h-full bg-linear-to-br from-blue-400 to-blue-600 rounded-full"></div>
              )}
            </div>
          </div>

          {/* Always show just the address on mobile; also show on desktop after icons */}
          <span className="truncate md:ml-1" title={wallet.address}>
            {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm">
          <div className="font-medium">Connected Wallet</div>
          <div className="text-xs text-muted-foreground font-mono truncate">
            {wallet.address}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Balance: {Number(wallet.balance || 0).toFixed(7)} XLM
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void handleCopyAddress();
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            void handleRefreshBalance();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Balance
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDisconnect}
          className="text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
