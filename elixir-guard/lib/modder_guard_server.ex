defmodule ModderGuardServer do
  use Plug.Router

  plug :match
  plug :dispatch

  get "/" do
    send_resp(conn, 200, "Modder Guard is online!")
  end

  get "/health" do
    response = %{
      status: "online",
      service: "Modder Guard",
      version: "0.1.0",
      language: "Elixir"
    }

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(response))
  end

  match _ do
    send_resp(conn, 404, "Route not found")
  end
end