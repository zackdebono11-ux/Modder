
defmodule ModderGuardDefender do
  @scan_timeout 120_000

  def scan_file(file_path) do
    scanner = find_scanner()

    cond do
      not File.regular?(file_path) ->
        {:error, "File does not exist"}

      is_nil(scanner) ->
        {:error, "Windows Defender scanner unavailable"}

      true ->
        run_scan(scanner, file_path)
    end
  end

  defp find_scanner do
    platform_path =
      "C:\\ProgramData\\Microsoft\\Windows Defender\\Platform"

    case File.ls(platform_path) do
      {:ok, folders} ->
        folders
        |> Enum.sort(:desc)
        |> Enum.map(
          &Path.join([platform_path, &1, "MpCmdRun.exe"])
        )
        |> Enum.find(&File.regular?/1)

      {:error, _reason} ->
        nil
    end
  end

  defp run_scan(scanner, file_path) do
    windows_path =
      file_path
      |> Path.expand()
      |> String.replace("/", "\\")

    task =
      Task.async(fn ->
        System.cmd(
          scanner,
          ["-Scan", "-ScanType", "3", "-File", windows_path],
          stderr_to_stdout: true
        )
      end)

    case Task.yield(task, @scan_timeout) ||
           Task.shutdown(task, :brutal_kill) do

      {:ok, {output, 0}} ->
        classify_output(output)

      {:ok, {output, exit_code}} ->
        {:error, %{
          scanner: "Microsoft Defender",
          status: "scan_failed",
          exit_code: exit_code,
          output: output
        }}

      nil ->
        {:error, %{
          scanner: "Microsoft Defender",
          status: "timeout",
          output: "The scan exceeded the 120-second time limit."
        }}
    end
  end

  defp classify_output(output) do
    normalized = String.downcase(output)

    cond do
      String.contains?(normalized, "found no threats") ->
        {:ok, %{
          scanner: "Microsoft Defender",
          status: "no_threats_detected",
          output: output
        }}

      String.contains?(normalized, "threat") ->
        {:error, %{
          scanner: "Microsoft Defender",
          status: "threat_or_warning_reported",
          output: output
        }}

      true ->
        {:error, %{
          scanner: "Microsoft Defender",
          status: "inconclusive",
          output: output
        }}
    end
  end
end
