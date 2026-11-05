defmodule ModderGuard do
  def start do
    IO.puts("🌴 Modder Guard is starting...")

    {:ok, _pid} =
      Bandit.start_link(
        plug: ModderGuardServer,
        ip: {127, 0, 0, 1},
        port: 4000
      )

    IO.puts("Modder Guard listening on http://localhost:4000")

    Process.sleep(:infinity)
  end
end